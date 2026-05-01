import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useData } from "@/context/DataProvider";
import { formatBytes } from "@/lib/formatters";
import { Folder, Upload, Search, FileText, FileSpreadsheet, Image as ImageIcon, File, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const typeIcon = { pdf: FileText, docx: FileText, xlsx: FileSpreadsheet, image: ImageIcon, other: File };

export default function Documents() {
  const { documents, employees } = useData();
  const folders = Array.from(new Set(documents.map((d) => d.folder)));
  const [folder, setFolder] = useState<string>("All");
  const [q, setQ] = useState("");

  const list = documents.filter((d) =>
    (folder === "All" || d.folder === folder) &&
    d.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <PageHeader title="Documents" description="Centralized files with folder structure and permissions." actions={<Button><Upload className="h-4 w-4 mr-1.5" />Upload</Button>} />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <Card className="p-3 h-fit">
          <p className="text-xs font-semibold text-muted-foreground uppercase px-2 py-1">Folders</p>
          <button
            className={cn("w-full text-left flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-surface-muted", folder === "All" && "bg-primary-soft text-primary font-medium")}
            onClick={() => setFolder("All")}
          >
            <Folder className="h-4 w-4" />All files
            <span className="ml-auto text-xs text-muted-foreground">{documents.length}</span>
          </button>
          {folders.map((f) => (
            <button
              key={f}
              className={cn("w-full text-left flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-surface-muted", folder === f && "bg-primary-soft text-primary font-medium")}
              onClick={() => setFolder(f)}
            >
              <Folder className="h-4 w-4" />{f}
              <span className="ml-auto text-xs text-muted-foreground">{documents.filter((d) => d.folder === f).length}</span>
            </button>
          ))}
        </Card>
        <Card className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files…" className="pl-9" />
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Owner</TableHead><TableHead>Permission</TableHead><TableHead className="hidden md:table-cell">Uploaded</TableHead><TableHead className="text-right">Size</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {list.map((d) => {
                const Icon = typeIcon[d.type];
                const owner = employees.find((e) => e.id === d.ownerId);
                return (
                  <TableRow key={d.id}>
                    <TableCell><div className="flex items-center gap-3"><Icon className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{d.name}</span></div></TableCell>
                    <TableCell className="text-sm">{owner?.name}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize text-xs">{d.permission}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{format(new Date(d.uploadedAt), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right text-sm">{formatBytes(d.size)}</TableCell>
                    <TableCell><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
