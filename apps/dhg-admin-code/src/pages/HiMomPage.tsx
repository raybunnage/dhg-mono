import React from 'react';
import { DashboardLayout } from '../components/DashboardLayout';

export const HiMomPage: React.FC = () => {
  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-6xl font-bold text-green-800 mb-4 animate-pulse">
          Hi Mom! 👋
        </h1>
        <p className="text-xl text-green-600 mb-8">
          This page was made just for you! 💚
        </p>
        <div className="text-4xl animate-bounce">
          🌻 🌸 🌺 🌷 🌹
        </div>
      </div>
    </DashboardLayout>
  );
};