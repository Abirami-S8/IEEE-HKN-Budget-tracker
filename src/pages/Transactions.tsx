import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Upload, FileText, X } from 'lucide-react';
import { z } from 'zod';

const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number().positive('Amount must be positive'),
  category: z.string().min(1, 'Category is required'),
  notes: z.string().optional(),
  status: z.enum(['completed', 'planned', 'recurring']),
  transaction_date: z.number(),
  is_recurring: z.boolean(),
  recurrence_interval: z.string().optional(),
});

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  notes: string;
  status: 'completed' | 'planned' | 'recurring';
  transaction_date: number;
  is_recurring: boolean;
  recurrence_interval: string;
  receipt_url: string | null;
}

export default function Transactions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [academicYearId, setAcademicYearId] = useState<string>('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const [formData, setFormData] = useState({
    type: 'income' as 'income' | 'expense',
    amount: '',
    category: '',
    notes: '',
    status: 'completed' as 'completed' | 'planned' | 'recurring',
    transaction_date: new Date().toISOString().split('T')[0],
    is_recurring: false,
    recurrence_interval: '',
    receipt_url: null as string | null,
  });

  useEffect(() => {
    if (user) {
      fetchAcademicYear();
    }
  }, [user]);

  useEffect(() => {
    if (academicYearId) {
      fetchTransactions();
    }
  }, [academicYearId]);

  const fetchAcademicYear = async () => {
    const { data } = await supabase
      .from('academic_years')
      .select('id')
      .eq('is_current', true)
      .single();

    if (data) {
      setAcademicYearId(data.id);
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user?.id)
        .eq('academic_year_id', academicYearId)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading transactions',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadReceipt = async (transactionId: string): Promise<string | null> => {
    if (!receiptFile || !user?.id) return null;

    try {
      setUploadingReceipt(true);
      const fileExt = receiptFile.name.split('.').pop();
      const fileName = `${user.id}/${transactionId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, receiptFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('receipts').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (error: any) {
      console.error('Receipt upload error:', error);
      toast({
        title: 'Receipt upload failed',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploadingReceipt(false);
    }
  };

  const deleteReceipt = async (receiptUrl: string) => {
    try {
      const fileName = receiptUrl.split('/receipts/')[1];
      if (fileName) {
        await supabase.storage.from('receipts').remove([fileName]);
      }
    } catch (error) {
      console.error('Error deleting receipt:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const transactionDate = new Date(formData.transaction_date).getTime() / 1000;
      
      const validatedData = transactionSchema.parse({
        ...formData,
        amount: parseFloat(formData.amount),
        transaction_date: transactionDate,
      });

      if (editingTransaction) {
        let receipt_url = formData.receipt_url;
        
        if (receiptFile) {
          if (receipt_url) {
            await deleteReceipt(receipt_url);
          }
          receipt_url = await uploadReceipt(editingTransaction.id) || null;
        }

        const { error } = await supabase
          .from('transactions')
          .update({
            ...validatedData,
            receipt_url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTransaction.id);

        if (error) throw error;

        toast({
          title: 'Transaction updated',
          description: 'Your transaction has been updated successfully.',
        });
      } else {
        const insertData = {
          type: validatedData.type,
          amount: validatedData.amount,
          category: validatedData.category,
          notes: validatedData.notes,
          status: validatedData.status,
          transaction_date: validatedData.transaction_date,
          is_recurring: validatedData.is_recurring,
          recurrence_interval: validatedData.recurrence_interval,
          user_id: user?.id!,
          academic_year_id: academicYearId,
        };

        const { data: newTransaction, error: insertError } = await supabase
          .from('transactions')
          .insert([insertData])
          .select()
          .single();

        if (insertError) throw insertError;

        if (receiptFile && newTransaction) {
          const receipt_url = await uploadReceipt(newTransaction.id);
          if (receipt_url) {
            await supabase
              .from('transactions')
              .update({ receipt_url })
              .eq('id', newTransaction.id);
          }
        }

        toast({
          title: 'Transaction added',
          description: 'Your transaction has been added successfully.',
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchTransactions();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Validation error',
          description: error.errors[0].message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      }
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      type: transaction.type,
      amount: transaction.amount.toString(),
      category: transaction.category,
      notes: transaction.notes || '',
      status: transaction.status,
      transaction_date: new Date(transaction.transaction_date * 1000).toISOString().split('T')[0],
      is_recurring: transaction.is_recurring,
      recurrence_interval: transaction.recurrence_interval || '',
      receipt_url: transaction.receipt_url,
    });
    setReceiptFile(null);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
      const transaction = transactions.find(t => t.id === id);
      if (transaction?.receipt_url) {
        await deleteReceipt(transaction.receipt_url);
      }

      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Transaction deleted',
        description: 'The transaction has been deleted successfully.',
      });

      fetchTransactions();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setEditingTransaction(null);
    setReceiptFile(null);
    setFormData({
      type: 'income',
      amount: '',
      category: '',
      notes: '',
      status: 'completed',
      transaction_date: new Date().toISOString().split('T')[0],
      is_recurring: false,
      recurrence_interval: '',
      receipt_url: null,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Transactions</h2>
            <p className="text-muted-foreground">Manage your income and expenses</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTransaction ? 'Edit' : 'Add'} Transaction</DialogTitle>
                <DialogDescription>
                  {editingTransaction ? 'Update' : 'Create'} a transaction record
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount ($)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Grant, Event, Sponsor"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="recurring">Recurring</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.transaction_date}
                    onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="receipt">Receipt (Optional)</Label>
                  <div className="space-y-2">
                    {formData.receipt_url && !receiptFile && (
                      <div className="flex items-center gap-2 p-2 border rounded">
                        <FileText className="h-4 w-4" />
                        <a 
                          href={formData.receipt_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex-1"
                        >
                          View current receipt
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormData({ ...formData, receipt_url: null })}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Input
                        id="receipt"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                        className="flex-1"
                      />
                      {receiptFile && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setReceiptFile(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {receiptFile && (
                      <p className="text-sm text-muted-foreground">
                        Selected: {receiptFile.name}
                      </p>
                    )}
                  </div>
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={uploadingReceipt}>
                    {uploadingReceipt ? (
                      <>
                        <Upload className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>{editingTransaction ? 'Update' : 'Add'} Transaction</>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Transactions</CardTitle>
            <CardDescription>View and manage your transaction history</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading transactions...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No transactions yet. Add your first transaction to get started!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Receipt</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {transaction.type === 'income' ? (
                              <TrendingUp className="h-4 w-4 text-success" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-destructive" />
                            )}
                            <span className="capitalize">{transaction.type}</span>
                          </div>
                        </TableCell>
                        <TableCell className={transaction.type === 'income' ? 'text-success' : 'text-destructive'}>
                          ${Number(transaction.amount).toFixed(2)}
                        </TableCell>
                        <TableCell>{transaction.category}</TableCell>
                        <TableCell>
                          <Badge variant={transaction.status === 'completed' ? 'default' : 'secondary'}>
                            {transaction.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(transaction.transaction_date * 1000).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {transaction.receipt_url ? (
                            <a
                              href={transaction.receipt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              <FileText className="h-4 w-4" />
                              View
                            </a>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(transaction)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(transaction.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
