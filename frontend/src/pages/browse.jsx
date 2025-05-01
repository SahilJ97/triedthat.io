import React from 'react';
import Logs from '@/components/logs';

const LandingPage = () => {
  return (
    <main className="w-full flex flex-col items-center px-2 sm:px-0 mt-8 mb-8">
      <section className="w-full max-w-2xl mx-auto text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Welcome to triedthat.io</h1>
        <p className="text-muted-foreground text-base sm:text-lg mb-2">
          Recently-shared experiences
        </p>
      </section>
      <Logs />
    </main>
  );
};

export default LandingPage;
