// app/(auth)/layout.js
import React from "react";

export default function AuthLayout({ children }) {
  return (
    <div className="flex justify-center items-center min-h-screen bg-background">
      {children}
    </div>
  );
}




