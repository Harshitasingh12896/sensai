"use client";
import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="w-full max-w-md p-4">
      <SignUp />
    </div>
  );
}
