import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from "@/lib/utils";
import StatePanel from '@/components/common/StatePanel';

export default function DataTable({ 
  columns, 
  data, 
  isLoading,
  searchPlaceholder = "Buscar...",
  searchValue,
  onSearchChange,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  emptyMessage = "Nenhum registro encontrado",
  onRowClick,
  highlightedRowId,
  getRowClassName,
}) {
  return (
    <div className="space-y-4">
      {onSearchChange && (
        <div className="app-search-field">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
          />
        </div>
      )}

      <div className="app-surface-card overflow-hidden">
        <Table aria-busy={isLoading}>
          <TableHeader>
            <TableRow className="bg-accent/60 hover:bg-accent/60">
              {columns.map((column) => (
                <TableHead 
                  key={column.key} 
                  className={cn("font-semibold text-muted-foreground", column.className)}
                >
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <StatePanel
                    compact
                    variant="loading"
                    title="Carregando registros"
                    description="Estamos atualizando a tabela sem descartar o contexto da tela."
                  />
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32">
                  <StatePanel
                    compact
                    variant="empty"
                    title="Nenhum registro encontrado"
                    description={emptyMessage}
                  />
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => (
                <TableRow 
                  key={row.id || index}
                  className={cn(
                    "transition-colors",
                    onRowClick && "cursor-pointer",
                    highlightedRowId && row.id === highlightedRowId && "bg-[hsl(var(--accent)/0.72)]",
                    getRowClassName?.(row)
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.cellClassName}>
                      {column.render ? column.render(row) : row[column.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(currentPage + 1)}
              disabled={currentPage >= totalPages}
              aria-label="Próxima página"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
