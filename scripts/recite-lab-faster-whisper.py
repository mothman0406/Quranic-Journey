#!/usr/bin/env python3
import argparse
import json
import os
import re
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

from faster_whisper import WhisperModel


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
LAB_DIR = ROOT_DIR / "artifacts" / "recite-lab"
ANALYSIS_DIR = LAB_DIR / "analysis"
DATASET_FILE = ANALYSIS_DIR / "dataset.jsonl"
DEFAULT_RESULTS_FILE = ANALYSIS_DIR / "faster-whisper-results.jsonl"
DEFAULT_SUMMARY_FILE = ANALYSIS_DIR / "faster-whisper-summary.json"
EXPERIMENT_VERSION = "recite-lab-faster-whisper-v0.1"
KNOWN_LABELS = {"correct", "skip", "repeat", "wrong", "noisy"}


def parse_args():
    parser = argparse.ArgumentParser(description="Run faster-whisper over Recite Lab audio.")
    parser.add_argument("--model", default="tiny", help="faster-whisper model name, e.g. tiny/base/small")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--language", default="ar")
    parser.add_argument("--scope", default=None)
    parser.add_argument("--ids", nargs="*", default=[])
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--false-rejects", action="store_true")
    parser.add_argument("--correct-only", action="store_true")
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def read_jsonl(path):
    if not path.exists():
        raise FileNotFoundError(f"Missing {path.relative_to(ROOT_DIR)}. Run analyze-recite-lab first.")
    rows = []
    with path.open("r", encoding="utf-8") as handle:
        for index, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as error:
                raise ValueError(f"Could not parse {path.name} line {index}: {error}") from error
    return rows


def normalize_arabic(value):
    value = re.sub(r"[\u064B-\u065F\u0670]", "", value or "")
    value = re.sub(r"[إأآٱ]", "ا", value)
    value = value.replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي").replace("ة", "ه")
    value = re.sub(r"[^\u0621-\u064A]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def compact_arabic(value):
    return normalize_arabic(value).replace("ا", "")


def tokenize_arabic(value):
    normalized = normalize_arabic(value)
    return [token for token in normalized.split(" ") if token]


def words_match(a, b):
    if not a or not b:
        return False
    if a == b:
        return True
    if a.startswith("ال") and a[2:] == b:
        return True
    if b.startswith("ال") and b[2:] == a:
        return True
    return compact_arabic(a) == compact_arabic(b)


def align_score(expected_words, heard_tokens):
    expected = [normalize_arabic(word) for word in expected_words if normalize_arabic(word)]
    heard = [normalize_arabic(token) for token in heard_tokens if normalize_arabic(token)]
    if not expected:
        return {
            "matchedCount": 0,
            "missingCount": 0,
            "extraCount": len(heard),
            "substituteCount": 0,
            "score": 0,
            "decision": "uncertain",
        }

    rows = len(expected) + 1
    cols = len(heard) + 1
    costs = [[0] * cols for _ in range(rows)]
    ops = [["start"] * cols for _ in range(rows)]
    for i in range(1, rows):
        costs[i][0] = i
        ops[i][0] = "missing"
    for j in range(1, cols):
        costs[0][j] = j
        ops[0][j] = "extra"

    for i in range(1, rows):
        for j in range(1, cols):
            match_cost = 0 if words_match(expected[i - 1], heard[j - 1]) else 1.15
            choices = [
                (costs[i - 1][j - 1] + match_cost, "match" if match_cost == 0 else "substitute"),
                (costs[i - 1][j] + 1.0, "missing"),
                (costs[i][j - 1] + 0.65, "extra"),
            ]
            best_cost, best_op = min(choices, key=lambda item: item[0])
            costs[i][j] = best_cost
            ops[i][j] = best_op

    i = len(expected)
    j = len(heard)
    matched = missing = extra = substitute = 0
    first_issues = []
    while i > 0 or j > 0:
        op = ops[i][j]
        if op == "match":
            matched += 1
            i -= 1
            j -= 1
        elif op == "substitute":
            substitute += 1
            if len(first_issues) < 5:
                first_issues.append(
                    {
                        "type": "substitute",
                        "expected": expected[i - 1],
                        "heard": heard[j - 1],
                        "expectedIndex": i,
                        "heardIndex": j,
                    }
                )
            i -= 1
            j -= 1
        elif op == "missing":
            missing += 1
            if len(first_issues) < 5:
                first_issues.append(
                    {
                        "type": "missing",
                        "expected": expected[i - 1],
                        "heard": None,
                        "expectedIndex": i,
                        "heardIndex": None,
                    }
                )
            i -= 1
        elif op == "extra":
            extra += 1
            if len(first_issues) < 5:
                first_issues.append(
                    {
                        "type": "extra",
                        "expected": None,
                        "heard": heard[j - 1],
                        "expectedIndex": None,
                        "heardIndex": j,
                    }
                )
            j -= 1
        else:
            break

    score = max(0, min(1, 1 - (missing + extra * 0.65 + substitute * 1.15) / len(expected)))
    if score >= 0.92 and missing == 0 and substitute == 0 and extra <= 1:
        decision = "pass"
    elif matched / len(expected) < 0.55:
        decision = "wrong"
    elif missing >= max(extra, substitute, 1):
        decision = "skip"
    elif substitute > 0:
        decision = "wrong"
    elif extra > 0:
        decision = "repeat"
    else:
        decision = "uncertain"

    return {
        "matchedCount": matched,
        "missingCount": missing,
        "extraCount": extra,
        "substituteCount": substitute,
        "score": score,
        "decision": decision,
        "firstIssues": list(reversed(first_issues)),
    }


def row_scope(row):
    expected_scope = row.get("expectedScope") or {}
    return expected_scope.get("label") or expected_scope.get("mode") or "unknown"


def matches_id(row, prefixes):
    if not prefixes:
        return True
    row_id = row.get("id") or ""
    return any(row_id.startswith(prefix) for prefix in prefixes)


def select_rows(rows, args):
    selected = []
    for row in rows:
        label = ((row.get("labels") or {}).get("effective")) or "unlabeled"
        if label not in KNOWN_LABELS:
            continue
        if not ((row.get("audio") or {}).get("hasAudio")):
            continue
        if args.scope and row_scope(row) != args.scope:
            continue
        if not matches_id(row, args.ids):
            continue
        if args.correct_only and label != "correct":
            continue
        if args.false_rejects and not (
            label == "correct" and ((row.get("comparison") or {}).get("decision")) != "pass"
        ):
            continue
        selected.append(row)
    if args.limit is not None:
        selected = selected[: args.limit]
    return selected


def transcribe_row(model, row, args):
    audio_file = ROOT_DIR / ((row.get("audio") or {}).get("file") or "")
    segments, info = model.transcribe(
        str(audio_file),
        language=args.language,
        beam_size=5,
        word_timestamps=True,
        vad_filter=True,
        condition_on_previous_text=False,
    )
    segment_payloads = []
    word_payloads = []
    transcript_parts = []
    for segment in segments:
        segment_dict = {
            "id": segment.id,
            "start": segment.start,
            "end": segment.end,
            "text": segment.text,
            "avgLogprob": segment.avg_logprob,
            "noSpeechProb": segment.no_speech_prob,
        }
        words = []
        for word in segment.words or []:
            word_dict = {
                "word": word.word,
                "start": word.start,
                "end": word.end,
                "probability": word.probability,
            }
            words.append(word_dict)
            word_payloads.append(word_dict)
        segment_dict["words"] = words
        segment_payloads.append(segment_dict)
        transcript_parts.append(segment.text.strip())

    transcript = " ".join(part for part in transcript_parts if part)
    tokens = tokenize_arabic(transcript)
    alignment = align_score(row.get("expectedWords") or [], tokens)
    return {
        "id": row.get("id"),
        "shortId": (row.get("id") or "")[:8],
        "label": ((row.get("labels") or {}).get("effective")) or "unlabeled",
        "scope": row_scope(row),
        "audioFile": (row.get("audio") or {}).get("file"),
        "iosDecision": (row.get("comparison") or {}).get("decision"),
        "iosScore": (row.get("comparison") or {}).get("score"),
        "expectedWordCount": (row.get("counts") or {}).get("expected"),
        "iosHeardCount": (row.get("counts") or {}).get("heard"),
        "whisperTranscript": transcript,
        "whisperTokens": tokens,
        "whisperTokenCount": len(tokens),
        "whisperLanguage": info.language,
        "whisperLanguageProbability": info.language_probability,
        "alignment": alignment,
        "segments": segment_payloads,
        "words": word_payloads,
    }


def build_summary(args, rows, results):
    matrix = {}
    for result in results:
        key = f"{result['label']}:{result['alignment']['decision']}"
        matrix[key] = matrix.get(key, 0) + 1
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "experimentVersion": EXPERIMENT_VERSION,
        "model": args.model,
        "device": args.device,
        "computeType": args.compute_type,
        "language": args.language,
        "rowCount": len(rows),
        "resultCount": len(results),
        "matrix": matrix,
        "rows": [
            {
                "id": result["id"],
                "shortId": result["shortId"],
                "label": result["label"],
                "scope": result["scope"],
                "iosDecision": result["iosDecision"],
                "iosScore": result["iosScore"],
                "whisperDecision": result["alignment"]["decision"],
                "whisperScore": result["alignment"]["score"],
                "whisperTokenCount": result["whisperTokenCount"],
            }
            for result in results
        ],
    }


def main():
    args = parse_args()
    rows = select_rows(read_jsonl(DATASET_FILE), args)
    if not rows:
        raise SystemExit("No matching audio rows.")

    print(
        f"Loading faster-whisper model={args.model} device={args.device} compute={args.compute_type}"
    )
    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
    results = []
    for index, row in enumerate(rows, start=1):
        print(f"[{index}/{len(rows)}] {row.get('id', '')[:8]} {row_scope(row)}")
        results.append(transcribe_row(model, row, args))

    summary = build_summary(args, rows, results)

    if args.write:
        ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)
        with DEFAULT_RESULTS_FILE.open("w", encoding="utf-8") as handle:
            for result in results:
                handle.write(json.dumps(result, ensure_ascii=False) + "\n")
        DEFAULT_SUMMARY_FILE.write_text(
            json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

    if args.json:
        print(json.dumps({"summary": summary, "results": results}, ensure_ascii=False, indent=2))
    else:
        print("Recite Lab faster-whisper")
        print(f"Rows: {len(results)}")
        print(f"Matrix: {json.dumps(summary['matrix'], ensure_ascii=False)}")
        for row in summary["rows"]:
            print(
                f"- {row['shortId']} label={row['label']} scope={row['scope']} "
                f"ios={row['iosDecision']}({row['iosScore']}) "
                f"whisper={row['whisperDecision']}({row['whisperScore']:.3f}) "
                f"tokens={row['whisperTokenCount']}"
            )


if __name__ == "__main__":
    main()
