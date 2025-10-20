import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { MicrosoftIcon } from './icons';

const Header: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="bg-[#006934] text-white p-3 shadow-md">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center">
            <img src="https://i.ibb.co/nMdwMV4S/pvn-log.png" alt="Petrovietnam Logo" className="h-12 w-12 mr-4 bg-white rounded-md p-1" />
            <div>
              <h1 className="text-xl font-bold">Petrovietnam - Báo cáo Quản trị</h1>
              <p className="text-sm">Tập đoàn Công nghiệp - Năng lượng Quốc gia Việt Nam</p>
            </div>
        </div>
        <div>
            {session ? (
                <div className="flex items-center gap-4">
                    <span className="text-sm hidden sm:block">{session.user.email}</span>
                    <button 
                        onClick={handleLogout}
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md transition-colors duration-200 text-sm"
                    >
                        Đăng xuất
                    </button>
                </div>
            ) : (
                <button 
                    onClick={handleLogin}
                    className="bg-white hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-md transition-colors duration-200 flex items-center gap-2 text-sm"
                >
                    <MicrosoftIcon />
                    Đăng nhập với Microsoft
                </button>
            )}
        </div>
      </div>
    </header>
  );
};

export default Header;