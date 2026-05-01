import { createContext, useContext, useState, ReactNode } from "react";
import { mockDB, type MockDB } from "@/lib/mockData";

interface DataContextValue extends MockDB {
  setClients: (v: MockDB["clients"]) => void;
  setEmployees: (v: MockDB["employees"]) => void;
  setShifts: (v: MockDB["shifts"]) => void;
  setInvoices: (v: MockDB["invoices"]) => void;
  setDocuments: (v: MockDB["documents"]) => void;
  setGoals: (v: MockDB["goals"]) => void;
  setSops: (v: MockDB["sops"]) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState(mockDB.clients);
  const [employees, setEmployees] = useState(mockDB.employees);
  const [shifts, setShifts] = useState(mockDB.shifts);
  const [invoices, setInvoices] = useState(mockDB.invoices);
  const [documents, setDocuments] = useState(mockDB.documents);
  const [goals, setGoals] = useState(mockDB.goals);
  const [sops, setSops] = useState(mockDB.sops);

  return (
    <DataContext.Provider
      value={{
        clients, employees, shifts, invoices, documents, goals, sops,
        activity: mockDB.activity,
        alerts: mockDB.alerts,
        setClients, setEmployees, setShifts, setInvoices, setDocuments, setGoals, setSops,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
