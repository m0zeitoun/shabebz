import { useEffect, useState } from 'react';
import { X, Megaphone } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Announcement {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [visible, setVisible] = useState(false);

  const fetchLatest = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('id, title, message, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const dismissed = localStorage.getItem(`dismissed_announcement_${data.id}`);
      if (!dismissed) {
        setAnnouncement(data);
        setVisible(true);
      }
    }
  };

  useEffect(() => {
    fetchLatest();

    const sub = supabase
      .channel('announcements-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, () => {
        fetchLatest();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'announcements' }, () => {
        fetchLatest();
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  const dismiss = () => {
    if (announcement) {
      localStorage.setItem(`dismissed_announcement_${announcement.id}`, '1');
    }
    setVisible(false);
  };

  if (!visible || !announcement) return null;

  return (
    <div className="relative bg-gradient-to-r from-gold/15 via-gold/10 to-gold/5 border-b border-gold/20 px-4 py-3 animate-fade-in">
      <div className="max-w-7xl mx-auto flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center mt-0.5">
          <Megaphone className="w-4 h-4 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-white text-sm leading-tight">
            {announcement.title}
          </p>
          <p className="text-white/60 text-xs mt-0.5 leading-relaxed">
            {announcement.message}
          </p>
        </div>
        <button
          onClick={dismiss}
          className="flex-shrink-0 w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/40 hover:text-white/80 transition-all mt-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
