import React from 'react';
import Logs from '@/components/logs';
import { useAuth } from "@/contexts/auth-context";

const UserEntries = () => {
  const { user } = useAuth();
  return (
    <main className="w-full flex flex-col items-center px-2 sm:px-0 mt-8 mb-8">
      <section className="w-full max-w-2xl mx-auto text-center mb-8">
        <p className="text-muted-foreground text-base sm:text-lg mb-2">
          Your entries
        </p>
      </section>
      <Logs user={user.user_id}/>
    </main>
  );
};

export default UserEntries;
