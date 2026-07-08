import { createContext, useContext, useState, ReactNode } from "react";

type Ctx = {
  query: string;
  setQuery: (v: string) => void;
};

const HeaderSearchCtx = createContext<Ctx>({ query: "", setQuery: () => {} });

export function HeaderSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  return (
    <HeaderSearchCtx.Provider value={{ query, setQuery }}>
      {children}
    </HeaderSearchCtx.Provider>
  );
}

export function useHeaderSearch() {
  return useContext(HeaderSearchCtx);
}
