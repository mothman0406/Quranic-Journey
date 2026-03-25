export interface StoryData {
  id: number;
  title: string;
  category: "prophet" | "companion" | "quran" | "moral";
  ageGroup: "toddler" | "child" | "preteen" | "teen";
  summary: string;
  readingTimeMinutes: number;
  featuredCharacter: string;
  morals: string[];
  content: string;
  relatedSurahs: string[];
  discussionQuestions: string[];
}

export const STORIES: StoryData[] = [
  {
    id: 1,
    title: "The Elephant Army",
    category: "quran",
    ageGroup: "toddler",
    summary: "A powerful king came with elephants to destroy the Ka'bah. See how Allah protected His house with tiny birds!",
    readingTimeMinutes: 3,
    featuredCharacter: "Abraha",
    morals: ["Allah protects His house", "No army can defeat Allah", "Trust in Allah's power"],
    relatedSurahs: ["Al-Fil"],
    discussionQuestions: [
      "Why do you think the elephant refused to walk toward the Ka'bah?",
      "What does this story teach us about Allah's power?",
      "If you were there, how would you have felt?"
    ],
    content: `Long ago, before the Prophet Muhammad ﷺ was born, there was a proud king named Abraha who ruled over Yemen. He had a beautiful church he built, and he wanted everyone to come there instead of going to Makkah.

But the people loved the Ka'bah — the house that Prophet Ibrahim built for Allah. So Abraha made a terrible decision: he would march his giant army to Makkah and destroy the Ka'bah!

Abraha had a huge elephant named Mahmoud leading his army. The people of Makkah were terrified. Their leader, Abd al-Muttalib (the grandfather of the Prophet ﷺ), didn't fight. He said, "The Ka'bah has its own Lord who will protect it."

Something amazing happened when the army reached Makkah. The great elephant Mahmoud — who had marched through cities and never refused a command — sat down and refused to move toward the Ka'bah! The soldiers pushed and prodded, but he would not go.

Then, from the sea, Allah sent flocks of tiny birds called Ababeel. Each bird carried three small stones — one in its beak and one in each claw. They dropped the stones on Abraha's army. Each stone was no bigger than a chickpea, but wherever it hit, it destroyed.

The entire mighty army was scattered like eaten straw. Abraha himself was wounded and died on his way back. The Ka'bah stood unharmed, protected by Allah alone.

That same year, the Prophet Muhammad ﷺ was born. SubhanAllah!`
  },
  {
    id: 2,
    title: "Ibrahim and the Fire",
    category: "prophet",
    ageGroup: "child",
    summary: "Prophet Ibrahim refused to worship idols even when thrown into a massive fire. Allah made it cool and safe for him!",
    readingTimeMinutes: 5,
    featuredCharacter: "Prophet Ibrahim ﷺ",
    morals: ["Stay firm in faith no matter what", "Allah protects those who trust Him", "Courage means standing for truth"],
    relatedSurahs: ["Al-Anbiya", "As-Saffat"],
    discussionQuestions: [
      "Why did Ibrahim break the idols?",
      "How did Ibrahim stay so brave when facing the fire?",
      "What would you say to someone who asked you to do something wrong?"
    ],
    content: `Ibrahim lived among a people who worshipped statues made of wood and stone. As a young man, he asked them: "Why do you worship things that cannot hear you, see you, or help you?"

His own father carved idols! But Ibrahim knew with his heart that only Allah — the One who created the heavens and earth — deserved to be worshipped.

One day, when all the people went to a festival, Ibrahim stayed behind. He took his axe and smashed all the idols in the temple — except the biggest one. He hung his axe around the neck of the biggest idol.

When the people returned and saw the destruction, they were furious. "Who did this?" they demanded.

"Ask that big idol," Ibrahim said calmly. "He has an axe — maybe he did it."

"You know idols can't talk!" they said.

"Then why do you worship something that can't even speak?" Ibrahim replied.

They had no answer, but their hearts were hard. They built the biggest fire anyone had ever seen — a fire so huge that birds flying over it would fall from the heat. Then they threw Ibrahim into it.

But Allah gave a command: "O fire, be cool and safe for Ibrahim."

The flames burned brightly, but Ibrahim sat inside the fire as if he were in a garden. He came out without a single burn mark. The people who saw this were astonished.

Allah had saved His beloved friend — and Ibrahim continued to call people to worship Allah alone until the end of his life.`
  },
  {
    id: 3,
    title: "Musa and the Baby Basket",
    category: "prophet",
    ageGroup: "toddler",
    summary: "Baby Musa was placed in a basket on the river by his brave mother. See how Allah's plan kept him safe!",
    readingTimeMinutes: 4,
    featuredCharacter: "Prophet Musa ﷺ",
    morals: ["Trust Allah's plan", "Mothers' love is a gift from Allah", "Allah always has a plan"],
    relatedSurahs: ["Ta-Ha", "Al-Qasas"],
    discussionQuestions: [
      "How do you think baby Musa's mother felt when she put him in the basket?",
      "Why do you think Allah kept Musa safe in Pharaoh's own house?",
      "Can you think of a time when something scary turned out okay?"
    ],
    content: `Long ago in Egypt, there lived a cruel king called Pharaoh. He was so afraid that the children of Israel would rise against him that he made a terrible law: every baby boy born to the Israelites must be killed.

A mother named Yukabid had a beautiful baby boy. She hid him as long as she could. Then Allah inspired her heart with a plan: "Put your baby in a basket. Place it in the river. Do not fear — We will return him to you."

With a heart full of trust in Allah, she made a little basket, wrapped her baby in cloth, and placed him gently on the River Nile. She told her daughter: "Follow where the basket goes."

The basket floated down the great river and came to rest... right at Pharaoh's palace! The women of the palace found the baby and brought him to Pharaoh's wife, Asiyah. She took one look at the baby and her heart filled with love.

"Don't kill him," she begged Pharaoh. "He may be of use to us, or we may adopt him." And Pharaoh agreed.

But the baby would not feed from any woman who tried! The baby's sister, who had been watching all this, stepped forward: "Shall I tell you of a family who can take care of him?"

They said yes. And she ran home and brought... their own mother!

Allah had reunited Musa with his mother, kept him safe in the enemy's house, and even arranged for his mother to be paid to care for him. SubhanAllah — no one can outsmart Allah's plan!`
  },
  {
    id: 4,
    title: "The Cave of Thawr",
    category: "prophet",
    ageGroup: "child",
    summary: "During the hijrah to Madinah, Prophet Muhammad ﷺ and Abu Bakr hid in a cave. The enemies were right outside — but Allah protected them!",
    readingTimeMinutes: 5,
    featuredCharacter: "Prophet Muhammad ﷺ & Abu Bakr",
    morals: ["Relying on Allah gives us peace", "True friendship means sacrifice", "Allah is always with the believers"],
    relatedSurahs: ["At-Tawbah"],
    discussionQuestions: [
      "What made Abu Bakr such a good friend to the Prophet?",
      "How did the Prophet ﷺ calm Abu Bakr when he was scared?",
      "Who is your most trusted friend? What makes them special?"
    ],
    content: `The enemies of Makkah had made a terrible plan: they would send the best swordsmen from every tribe to kill the Prophet Muhammad ﷺ on the same night. This way, no single tribe could be blamed.

But Allah told His Prophet of the plan. The Prophet ﷺ escaped at night, leaving his cousin Ali in his bed. He went to the house of his dearest companion, Abu Bakr as-Siddiq.

Together, they slipped out of Makkah in the darkness, heading south — the opposite direction from Madinah — to confuse anyone following them. They climbed to a cave called Thawr.

The Quraysh sent search parties in every direction. A group came right to the cave's entrance! Abu Bakr whispered, trembling: "O Messenger of Allah, if one of them looks down, they will see us!"

The Prophet ﷺ said with complete calm: "What do you think of two, when Allah is their third?"

And truly, Allah was with them. A spider had woven its web across the cave entrance. A pigeon had built its nest there and laid eggs. The searchers looked at the cave and said: "No one could have gone inside — the spider's web and pigeon nest are undisturbed."

They walked away.

After three days, they continued their journey to Madinah, where thousands of people welcomed the Prophet ﷺ with joy. The hijrah — the migration — was complete, and a new chapter of Islam had begun.`
  },
  {
    id: 5,
    title: "Bilal and the Hot Desert",
    category: "companion",
    ageGroup: "child",
    summary: "Bilal was an enslaved man who became one of the greatest companions. He was tortured for saying 'Ahad! Ahad!' — but he never gave up faith.",
    readingTimeMinutes: 5,
    featuredCharacter: "Bilal ibn Rabah",
    morals: ["Standing firm in truth has a price, but is worth it", "Allah rewards patience", "All people are equal in Allah's sight"],
    relatedSurahs: ["Al-Inshirah"],
    discussionQuestions: [
      "What gave Bilal the strength to keep saying 'Ahad'?",
      "Why do you think Abu Bakr spent money to free Bilal?",
      "What was special about Bilal becoming the first mu'adhdhin?"
    ],
    content: `In the early days of Islam in Makkah, few people dared to say they were Muslim openly. One of the bravest was a man named Bilal.

Bilal was an enslaved Abyssinian man owned by a cruel master named Umayyah ibn Khalaf. When Umayyah found out Bilal had become Muslim, he was furious.

Every day during the blazing heat of the Arabian sun, Umayyah would drag Bilal to the desert. He placed a huge, heavy rock on his chest and demanded: "Deny Muhammad! Worship our gods!"

With cracked lips and burning skin, Bilal would look at the sky and say: "Ahad! Ahad!" — "One! One!" — meaning Allah is One and I will never deny Him.

The companions heard about this and were heartbroken. Abu Bakr as-Siddiq — who was a wealthy merchant — went to Umayyah. "How much do you want for him?" he asked.

He paid the price and freed Bilal.

When Bilal stood before the Prophet ﷺ as a free man, tears streamed down his face. The Prophet ﷺ loved Bilal dearly and trusted him completely.

When the Muslims reached Madinah, they needed someone to call people to prayer — the adhan. The Prophet ﷺ chose Bilal. His voice rose from the highest point in Madinah: "Allahu Akbar! Allahu Akbar!" — a voice that had once cried "Ahad" in the desert now called millions to prayer.

On the day Makkah was conquered, Bilal climbed to the top of the Ka'bah and gave the adhan. What a journey for the man who was once held down by a rock.`
  },
  {
    id: 6,
    title: "Yusuf and the Brothers",
    category: "prophet",
    ageGroup: "preteen",
    summary: "Prophet Yusuf was thrown in a well by his jealous brothers, sold as a slave, put in prison — yet he never lost hope in Allah. And in the end, Allah raised him to greatness.",
    readingTimeMinutes: 8,
    featuredCharacter: "Prophet Yusuf ﷺ",
    morals: ["Never lose hope in Allah", "Patience leads to relief", "Forgiveness is the mark of the great", "Allah's plan is always better"],
    relatedSurahs: ["Yusuf"],
    discussionQuestions: [
      "How did Yusuf manage to stay good even when people kept doing bad things to him?",
      "What do you think made it possible for Yusuf to forgive his brothers?",
      "Can you think of a time when something painful led to something good?"
    ],
    content: `Yusuf was the son of Prophet Ya'qub (Jacob), and his father loved him deeply. One night, young Yusuf had a dream: eleven stars, the sun, and the moon were all bowing to him. He told his father, who warned him to keep it secret.

But his brothers were jealous. "Our father loves Yusuf more than us!" they complained. They made a plan: they took Yusuf into the wilderness and threw him into a deep, dark well. They dipped his shirt in goat's blood and told their father a wolf had eaten him.

Ya'qub wept so much he lost his sight from grief.

Yusuf was found by travelers and sold as a slave in Egypt. He was bought by a nobleman named Al-Aziz. Though Yusuf worked faithfully, the nobleman's wife tried to tempt him into doing wrong. Yusuf refused and ran from the room. She lied about him, and Yusuf was thrown into prison.

In prison, Yusuf helped fellow prisoners understand their dreams. He asked one prisoner to mention him to the king — but the man forgot for years.

Then one night, the King of Egypt had a dream no one could explain: seven fat cows eaten by seven thin ones, seven green ears of corn and seven dry ones. The prisoner who had forgotten Yusuf remembered him and told the king.

Yusuf explained the dream: Egypt would have seven years of plenty followed by seven years of famine. The King was so impressed that he freed Yusuf and put him in charge of the granaries of all Egypt!

Years later, his brothers came to Egypt begging for food during the famine. They didn't recognize the powerful minister before them. But it was Yusuf. 

He tested them, kept them with him, and finally revealed himself. Instead of punishing them, Yusuf wept and embraced them. "Allah has been gracious to us all," he said. "He who is patient and fears Allah — Allah does not let the reward of good-doers be lost."

His father regained his sight when Yusuf's shirt was placed on his face. The whole family was reunited in Egypt, and the dream from Yusuf's childhood — eleven stars bowing to him — came true.

The entire story of Yusuf is called "Ahsan al-Qasas" — the best of stories. And indeed it is.`
  },
  {
    id: 7,
    title: "The Ant and Prophet Sulayman",
    category: "prophet",
    ageGroup: "toddler",
    summary: "Prophet Sulayman could talk to animals! When an ant warned its people to go underground before the army stepped on them, what did Sulayman do?",
    readingTimeMinutes: 3,
    featuredCharacter: "Prophet Sulayman ﷺ",
    morals: ["Be grateful for Allah's gifts", "Show mercy to all creatures", "Even small beings have feelings"],
    relatedSurahs: ["An-Naml"],
    discussionQuestions: [
      "Why did the ant warn its friends?",
      "What does it tell us about Sulayman that he smiled instead of getting angry?",
      "How can we show kindness to animals?"
    ],
    content: `Allah gave Prophet Sulayman many amazing gifts. He was a great king with a powerful army — humans, jinn, and birds all served him. And he could understand the language of animals!

One day, Sulayman's grand army was marching through a valley. Ahead of them, a colony of ants was going about their business.

A small ant spotted the massive army approaching. Quickly, she called out to her sisters: "O ants! Enter your homes, so that Sulayman and his armies do not crush you — and they might not even know they're doing it!"

Now, Sulayman could hear the ant's tiny voice in the crowd of thousands. He heard what she said — that he might crush them without even knowing. He smiled and started to laugh.

Then he raised his hands and thanked Allah: "My Lord, inspire me to be grateful for Your favors which You have given me and my parents, and to do righteousness of which You will approve. Admit me, by Your mercy, into the company of Your righteous servants."

The great king — with power over humans, jinn, birds, and wind — smiled at the tiny ant and made du'a to Allah. He didn't want even the smallest ant to be harmed. That is the mark of a truly merciful leader.

And the ant? She had done her job perfectly. SubhanAllah — even ants have a job to do for Allah.`
  },
  {
    id: 8,
    title: "Khadijah: The First Believer",
    category: "companion",
    ageGroup: "preteen",
    summary: "When the Prophet ﷺ came home shaking from his first revelation, it was Khadijah's firm faith and love that gave him strength. She was the first Muslim.",
    readingTimeMinutes: 5,
    featuredCharacter: "Khadijah bint Khuwaylid",
    morals: ["A good spouse supports your faith", "Courage to believe first", "Love and trust go together"],
    relatedSurahs: ["Al-'Alaq"],
    discussionQuestions: [
      "How did Khadijah support the Prophet ﷺ at his most frightening moment?",
      "What qualities made Khadijah so special?",
      "How can we support those we love when they are scared?"
    ],
    content: `Before the Prophet Muhammad ﷺ received revelation, he was known as Al-Amin — the Trustworthy. He was married to Khadijah, a wise and noble woman who was fifteen years older than him. She admired his honesty and character deeply.

The Prophet ﷺ would often go to the Cave of Hira on Mount Nur to think and worship Allah in private.

Then one night, everything changed.

The angel Jibril appeared to him and said: "Iqra!" — "Read!"

The Prophet said: "I cannot read." Jibril squeezed him tightly, then said again: "Read!" Again he replied he could not. Three times, until finally Jibril spoke the first words of Allah's revelation: "Read in the name of your Lord who created..."

The Prophet came home shaking, his heart pounding. "Cover me, cover me!" he said to Khadijah.

She wrapped him in a cloak and held him. When he had calmed, he told her what happened — afraid that something terrible had come to him.

Khadijah, without hesitation, said: "Never! By Allah, Allah will never disgrace you. You maintain family ties. You speak the truth. You help those who are weak. You give to guests. You support the truth."

Then she took him to her cousin Waraqah ibn Nawfal, a scholar, who confirmed: this was the same angel that had come to Prophet Musa. Muhammad was the Messenger of Allah.

Khadijah returned home and became the first person to believe — not just with her mind, but with her whole heart and life. She spent her wealth for Islam, she supported the Prophet through years of hardship, and she never doubted him for a single moment.

The Prophet ﷺ loved her until the end of his life, and Allah sent her salaam through Jibril.`
  }
];

export function getStoryById(id: number): StoryData | undefined {
  return STORIES.find(s => s.id === id);
}
