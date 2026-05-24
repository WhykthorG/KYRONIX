import React, { useDeferredValue, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/common/PageHeader';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Book, BookOpen, Search, Plus, Edit, Trash2, User, Loader2, 
  FileText, Disc, Headphones
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import { LibraryItemApi, LibraryLoanApi, StudentApi } from '@/services/supabaseApi';
import { useGlobalSearchNavigation } from '@/hooks/useGlobalSearchNavigation';

export default function LibraryPage({ globalSearch }) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [typeFilter, setTypeFilter] = useState('todos');
  const [showForm, setShowForm] = useState(false);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [loanData, setLoanData] = useState({});
  const [activeTab, setActiveTab] = useState('acervo');
  const [highlightedItemId, setHighlightedItemId] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['library-items'],
    queryFn: () => LibraryItemApi.list('-created_at'),
  });

  const { data: loans = [] } = useQuery({
    queryKey: ['library-loans'],
    queryFn: () => LibraryLoanApi.list('-created_at'),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => StudentApi.list(),
  });

  const createItemMutation = useMutation({
    mutationFn: (data) => LibraryItemApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-items'] });
      setShowForm(false);
      setFormData({});
      toast.success('Item cadastrado com sucesso!');
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }) => LibraryItemApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-items'] });
      setShowForm(false);
      setFormData({});
      setSelectedItem(null);
      toast.success('Item atualizado com sucesso!');
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id) => LibraryItemApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-items'] });
      toast.success('Item removido com sucesso!');
    },
  });

  const createLoanMutation = useMutation({
    mutationFn: (data) => LibraryLoanApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-loans'] });
      setShowLoanForm(false);
      setLoanData({});
      toast.success('Empréstimo registrado com sucesso!');
    },
  });

  const returnLoanMutation = useMutation({
    mutationFn: ({ id, data }) => LibraryLoanApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-loans'] });
      toast.success('Devolução registrada com sucesso!');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedItem) {
      updateItemMutation.mutate({ id: selectedItem.id, data: formData });
    } else {
      createItemMutation.mutate({ ...formData, is_available: true });
    }
  };

  const handleLoanSubmit = (e) => {
    e.preventDefault();
    createLoanMutation.mutate({ 
      ...loanData, 
      loan_date: format(new Date(), 'yyyy-MM-dd'),
      status: 'emprestado'
    });
  };

  const handleReturn = (loan) => {
    returnLoanMutation.mutate({
      id: loan.id,
      data: { ...loan, status: 'devolvido', return_date: format(new Date(), 'yyyy-MM-dd') }
    });
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setFormData(item);
    setShowForm(true);
  };

  const typeLabels = {
    livro: 'Livro',
    jogo: 'Jogo',
    periodico: 'Periódico',
    dvd: 'DVD',
    ebook: 'E-book',
    outro: 'Outro',
  };

  const typeIcons = {
    livro: Book,
    jogo: Disc,
    periodico: FileText,
    dvd: Disc,
    ebook: BookOpen,
    outro: Headphones,
  };

  const filteredItems = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    const normalizedTypeSearch = (() => {
      if (['livro', 'livros'].includes(normalizedSearch)) return 'livro';
      if (['jogo', 'jogos'].includes(normalizedSearch)) return 'jogo';
      if (['periodico', 'periodicos', 'periódico', 'periódicos'].includes(normalizedSearch)) return 'periodico';
      if (['dvd', 'dvds'].includes(normalizedSearch)) return 'dvd';
      if (['ebook', 'ebooks', 'e-book', 'e-books'].includes(normalizedSearch)) return 'ebook';
      if (['outro', 'outros'].includes(normalizedSearch)) return 'outro';
      return null;
    })();

    return items.filter((item) => {
      const itemType = String(item.type || 'outro').toLowerCase();
      const matchesType = typeFilter === 'todos' || itemType === typeFilter;

      if (!matchesType) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      if (normalizedTypeSearch && itemType === normalizedTypeSearch) {
        return true;
      }

      return [
        item.title,
        item.author,
        item.isbn,
        item.publisher,
        item.category,
        item.subject_area,
        item.description,
        typeLabels[itemType] || itemType,
      ].some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch));
    });
  }, [deferredSearch, items, typeFilter]);

  const getItemName = (id) => items.find(i => i.id === id)?.title || '-';
  const getStudentName = (id) => students.find(s => s.id === id)?.full_name || '-';

  const totalItems = items.length;
  const availableItems = useMemo(() => items.filter((i) => i.available_copies > 0).length, [items]);
  const activeLoans = useMemo(() => loans.filter((l) => l.status === 'emprestado').length, [loans]);

  useGlobalSearchNavigation({
    entityKey: 'library',
    globalSearch,
    isReady: !isLoading,
    onNavigate: ({ query, recordId }) => {
      setActiveTab('acervo');
      setShowForm(false);
      setShowLoanForm(false);
      setSelectedItem(null);
      setSearch(query || '');
      setHighlightedItemId(recordId || null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
          backTo="/Dashboard"
          backLabel="Dashboard"
        title="Biblioteca"
        subtitle="Gerenciamento do acervo e empréstimos"
        action={() => { setSelectedItem(null); setFormData({}); setShowForm(true); }}
        actionLabel="Novo Item"
        actionIcon={Plus}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-100">
              <Book className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total do Acervo</p>
              <p className="text-2xl font-bold">{totalItems}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-100">
              <BookOpen className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Disponíveis</p>
              <p className="text-2xl font-bold">{availableItems}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-100">
              <User className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Empréstimos Ativos</p>
              <p className="text-2xl font-bold">{activeLoans}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <Button 
            className="w-full h-full bg-indigo-600 hover:bg-indigo-700"
            onClick={() => setShowLoanForm(true)}
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Empréstimo
          </Button>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="acervo">Acervo</TabsTrigger>
          <TabsTrigger value="emprestimos">Empréstimos</TabsTrigger>
        </TabsList>

        <TabsContent value="acervo" className="mt-4">
          {/* Search */}
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-4 py-2 max-w-sm">
              <Search className="w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Buscar por título, autor, ISBN ou tipo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 bg-transparent focus-visible:ring-0 px-0 h-auto"
              />
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="library-type-filter" className="text-sm text-slate-600">Tipo</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger id="library-type-filter" className="w-[180px] bg-white">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="livro">Livros</SelectItem>
                  <SelectItem value="jogo">Jogos</SelectItem>
                  <SelectItem value="periodico">Periódicos</SelectItem>
                  <SelectItem value="dvd">DVDs</SelectItem>
                  <SelectItem value="ebook">E-books</SelectItem>
                  <SelectItem value="outro">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map((item) => {
              const Icon = typeIcons[item.type] || Book;
              return (
                <Card
                  key={item.id}
                  className={cn(
                    "hover:shadow-lg transition-shadow",
                    highlightedItemId === item.id && "ring-2 ring-indigo-300 ring-offset-2"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-3 rounded-xl bg-slate-100">
                        <Icon className="w-6 h-6 text-slate-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-900 truncate">{item.title}</h3>
                        <p className="text-sm text-slate-500 truncate">{item.author || 'Autor desconhecido'}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary">{typeLabels[item.type]}</Badge>
                          {item.available_copies > 0 ? (
                            <Badge className="bg-emerald-100 text-emerald-700">
                              {item.available_copies} disponível
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-100 text-rose-700">Indisponível</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-4 pt-3 border-t">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                        <Edit className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          if (confirm('Tem certeza que deseja excluir este item?')) {
                            deleteItemMutation.mutate(item.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Book className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>Nenhum item encontrado</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="emprestimos" className="mt-4">
          <div className="space-y-4">
            {loans.filter(l => l.status === 'emprestado').map(loan => (
              <Card key={loan.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-amber-100">
                      <Book className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">{getItemName(loan.item_id)}</h4>
                      <p className="text-sm text-slate-500">
                        Emprestado para: {getStudentName(loan.borrower_id)}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                        <span>Empréstimo: {format(new Date(loan.loan_date), 'dd/MM/yyyy')}</span>
                        <span>Devolução: {format(new Date(loan.due_date), 'dd/MM/yyyy')}</span>
                      </div>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => handleReturn(loan)}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Registrar Devolução
                  </Button>
                </CardContent>
              </Card>
            ))}

            {loans.filter(l => l.status === 'emprestado').length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>Nenhum empréstimo ativo</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Item Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedItem ? 'Editar Item' : 'Novo Item'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo *</Label>
                <Select
                  value={formData.type || ''}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Autor</Label>
                <Input
                  value={formData.author || ''}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ISBN</Label>
                <Input
                  value={formData.isbn || ''}
                  onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                />
              </div>
              <div>
                <Label>Editora</Label>
                <Input
                  value={formData.publisher || ''}
                  onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ano de Publicação</Label>
                <Input
                  type="number"
                  value={formData.publication_year || ''}
                  onChange={(e) => setFormData({ ...formData, publication_year: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Quantidade de Cópias</Label>
                <Input
                  type="number"
                  value={formData.total_copies || 1}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    total_copies: Number(e.target.value),
                    available_copies: Number(e.target.value)
                  })}
                />
              </div>
            </div>
            <div>
              <Label>Localização na Biblioteca</Label>
              <Input
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Ex: Estante A, Prateleira 3"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                {selectedItem ? 'Salvar Alterações' : 'Cadastrar Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Loan Form Modal */}
      <Dialog open={showLoanForm} onOpenChange={setShowLoanForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Empréstimo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLoanSubmit} className="space-y-4">
            <div>
              <Label>Item *</Label>
              <Select
                value={loanData.item_id || ''}
                onValueChange={(value) => setLoanData({ ...loanData, item_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o item" />
                </SelectTrigger>
                <SelectContent>
                  {items.filter(i => i.available_copies > 0).map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title} ({item.available_copies} disponível)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Aluno *</Label>
              <Select
                value={loanData.borrower_id || ''}
                onValueChange={(value) => setLoanData({ ...loanData, borrower_id: value, borrower_type: 'aluno' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o aluno" />
                </SelectTrigger>
                <SelectContent>
                  {students.map(student => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de Devolução *</Label>
              <Input
                type="date"
                value={loanData.due_date || ''}
                onChange={(e) => setLoanData({ ...loanData, due_date: e.target.value })}
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowLoanForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                Registrar Empréstimo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
