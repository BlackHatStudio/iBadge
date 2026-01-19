"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/tables/data-table";
import { DataTableColumnHeader } from "@/components/tables/data-table-column-header";
import { ThemeToggle } from "@/components/theme-toggle";

// Sample data type
type SampleData = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive";
  createdAt: string;
};

// Sample data
const sampleData: SampleData[] = [
  {
    id: 1,
    name: "John Doe",
    email: "john.doe@example.com",
    role: "Admin",
    status: "active",
    createdAt: "2024-01-15",
  },
  {
    id: 2,
    name: "Jane Smith",
    email: "jane.smith@example.com",
    role: "User",
    status: "active",
    createdAt: "2024-01-20",
  },
  {
    id: 3,
    name: "Bob Johnson",
    email: "bob.johnson@example.com",
    role: "Editor",
    status: "inactive",
    createdAt: "2024-01-25",
  },
  {
    id: 4,
    name: "Alice Williams",
    email: "alice.williams@example.com",
    role: "User",
    status: "active",
    createdAt: "2024-02-01",
  },
  {
    id: 5,
    name: "Charlie Brown",
    email: "charlie.brown@example.com",
    role: "Admin",
    status: "active",
    createdAt: "2024-02-05",
  },
  {
    id: 6,
    name: "Diana Prince",
    email: "diana.prince@example.com",
    role: "Editor",
    status: "inactive",
    createdAt: "2024-02-10",
  },
  {
    id: 7,
    name: "Edward Norton",
    email: "edward.norton@example.com",
    role: "User",
    status: "active",
    createdAt: "2024-02-15",
  },
  {
    id: 8,
    name: "Fiona Apple",
    email: "fiona.apple@example.com",
    role: "User",
    status: "active",
    createdAt: "2024-02-20",
  },
  {
    id: 9,
    name: "George Lucas",
    email: "george.lucas@example.com",
    role: "Admin",
    status: "inactive",
    createdAt: "2024-02-25",
  },
  {
    id: 10,
    name: "Helen Mirren",
    email: "helen.mirren@example.com",
    role: "Editor",
    status: "active",
    createdAt: "2024-03-01",
  },
];

// Column definitions
const columns: ColumnDef<SampleData>[] = [
  {
    accessorKey: "id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="ID" />
    ),
    cell: ({ row }) => <div className="font-medium">{row.getValue("id")}</div>,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => <div>{row.getValue("name")}</div>,
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
    cell: ({ row }) => <div className="text-muted-foreground">{row.getValue("email")}</div>,
  },
  {
    accessorKey: "role",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Role" />
    ),
    cell: ({ row }) => (
      <div className="capitalize">{row.getValue("role")}</div>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <div className={`capitalize ${status === "active" ? "text-green-600" : "text-red-600"}`}>
          {status}
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => <div>{row.getValue("createdAt")}</div>,
  },
];

export default function Home() {
  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">Project Template</h1>
        <p className="text-muted-foreground">
          Next.js + Express + Tailwind v4 template with DataTable and Button components
        </p>
      </div>

      {/* Button Examples */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Button Examples</h2>
        <div className="flex flex-wrap gap-4">
          <Button>Default Button</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
      </div>

      {/* DataTable Example */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">DataTable Example</h2>
        <div 
          className="datatable-vars"
          style={{
            '--row': 'hsl(var(--card))',
            '--rowAlt': 'hsl(var(--muted) / 0.3)',
            '--rowHover': 'hsl(var(--accent) / 0.1)',
            '--rowInk': 'hsl(var(--foreground))',
            '--rowBorder': 'hsl(var(--border))',
          } as React.CSSProperties}
        >
          <DataTable
            columns={columns}
            data={sampleData}
            initialPageSize={10}
            filterColumnId="name"
            filterPlaceholder="Search by name..."
            onRowClick={(row) => {
              console.log("Row clicked:", row.original);
            }}
          />
        </div>
      </div>

      {/* Theme Toggle */}
      <div className="space-y-4 p-6 border rounded-lg bg-muted/50">
        <h2 className="text-2xl font-semibold">Theme Toggling</h2>
        <p className="text-muted-foreground mb-4">
          Try different themes using the toggle buttons below:
        </p>
        <ThemeToggle />
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            You can also modify the <code className="bg-background px-2 py-1 rounded text-xs">className</code> prop on the <code className="bg-background px-2 py-1 rounded text-xs">&lt;html&gt;</code> tag in <code className="bg-background px-2 py-1 rounded text-xs">src/app/layout.tsx</code> for static theme selection.
          </p>
        </div>
      </div>
    </div>
  );
}
