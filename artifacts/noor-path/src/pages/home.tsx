import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Plus, ChevronRight, UserCircle2 } from "lucide-react";
import { useListChildren, useCreateChild } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button, Card, Input } from "@/components/ui-elements";

export default function Home() {
  const [_, setLocation] = useLocation();
  const { data: childrenData, isLoading, refetch } = useListChildren();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <Layout hideNav>
      <div className="py-8 space-y-8">
        <div className="text-center space-y-2">
          <p className="font-arabic text-3xl text-primary mb-4">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>
          <h1 className="text-3xl font-display font-bold text-foreground">Welcome to NoorPath</h1>
          <p className="text-muted-foreground">Your trusted companion for Islamic parenting.</p>
        </div>

        {showAdd ? (
          <AddChildForm onCancel={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); refetch(); }} />
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-bold px-1">Select Profile</h2>
            
            {isLoading ? (
              <div className="space-y-3">
                {[1,2].map(i => <div key={i} className="h-24 bg-secondary animate-pulse rounded-3xl" />)}
              </div>
            ) : childrenData?.children?.length === 0 ? (
              <Card className="text-center py-10 bg-primary/5 border-primary/10">
                <UserCircle2 className="w-16 h-16 mx-auto text-primary/40 mb-4" />
                <h3 className="text-lg font-bold mb-2">No Profiles Yet</h3>
                <p className="text-muted-foreground mb-6 text-sm">Create a profile for your child to start their learning journey.</p>
                <Button onClick={() => setShowAdd(true)}>Create Profile</Button>
              </Card>
            ) : (
              <div className="grid gap-4">
                {childrenData?.children.map((child, i) => (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    key={child.id}
                  >
                    <Link href={`/child/${child.id}`}>
                      <Card className="flex items-center p-4 hover:border-primary/30 transition-colors cursor-pointer group hover:shadow-2xl hover:shadow-primary/5">
                        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-3xl shadow-inner mr-4 group-hover:scale-110 transition-transform duration-300">
                          {child.avatarEmoji || '👦'}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold">{child.name}</h3>
                          <p className="text-sm text-muted-foreground capitalize">Age {child.age} • Level: {child.ageGroup}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </Card>
                    </Link>
                  </motion.div>
                ))}
                
                <Button variant="outline" className="w-full mt-4 border-dashed py-6 text-muted-foreground hover:text-primary hover:border-primary" onClick={() => setShowAdd(true)}>
                  <Plus className="w-5 h-5 mr-2" />
                  Add Another Child
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function AddChildForm({ onCancel, onSuccess }: { onCancel: () => void, onSuccess: () => void }) {
  const { mutate, isPending } = useCreateChild();
  const [formData, setFormData] = useState({ name: "", age: 7, gender: "male" as "male" | "female", avatarEmoji: "👦" });

  const emojis = ["👦", "👧", "👶", "🧕", "🧒", "🧑", "🦁", "🌟", "🌙"];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({ data: formData }, { onSuccess });
  };

  return (
    <Card className="border-primary/20 shadow-2xl shadow-primary/5">
      <h2 className="text-xl font-bold mb-6 font-display">New Child Profile</h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold mb-2">Child's Name</label>
          <Input required placeholder="E.g. Omar" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Age</label>
            <Input type="number" min={3} max={18} required value={formData.age} onChange={e => setFormData({...formData, age: parseInt(e.target.value)})} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">Gender</label>
            <select className="w-full rounded-2xl border-2 border-border bg-background/50 px-4 py-3 text-sm focus:outline-none focus:border-primary"
              value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as "male" | "female"})}
            >
              <option value="male">Boy</option>
              <option value="female">Girl</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Choose Avatar</label>
          <div className="flex flex-wrap gap-2">
            {emojis.map(e => (
              <button
                key={e} type="button"
                onClick={() => setFormData({...formData, avatarEmoji: e})}
                className={`w-12 h-12 text-2xl rounded-2xl flex items-center justify-center transition-all ${formData.avatarEmoji === e ? 'bg-primary text-white shadow-lg scale-110' : 'bg-secondary hover:bg-secondary/80'}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={isPending}>{isPending ? "Saving..." : "Create Profile"}</Button>
        </div>
      </form>
    </Card>
  );
}
