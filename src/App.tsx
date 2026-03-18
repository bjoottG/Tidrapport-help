import { useState } from "react";

export default function App() {
  const [name, setName] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          {name ? `Hej, ${name}!` : "Vad heter du?"}
        </h1>
        <input
          type="text"
          placeholder="Skriv ditt namn..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border border-input rounded-md px-4 py-2 text-base bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </div>
  );
}
