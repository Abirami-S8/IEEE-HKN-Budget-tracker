import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Download, FileText, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  transaction_date: number;
  status: string;
}

export default function Reports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [academicYearId, setAcademicYearId] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const yearData = await fetchAcademicYear();
    if (yearData) {
      await fetchTransactions(yearData);
    }
    setLoading(false);
  };

  const fetchAcademicYear = async () => {
    const { data } = await supabase
      .from('academic_years')
      .select('id')
      .eq('is_current', true)
      .single();

    if (data) {
      setAcademicYearId(data.id);
      return data.id;
    }
    return null;
  };

  const fetchTransactions = async (yearId: string) => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user?.id)
      .eq('academic_year_id', yearId)
      .order('transaction_date', { ascending: true });

    if (error) {
      console.error('Error fetching transactions:', error);
      return;
    }

    setTransactions(data || []);
  };

  const generateCSV = async (type: 'transactions' | 'deadlines') => {
    setGenerating(true);
    try {
      const table = type === 'transactions' ? 'transactions' : 'deadlines';
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', user?.id)
        .eq('academic_year_id', academicYearId);

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: 'No data',
          description: `No ${type} found to export`,
          variant: 'destructive',
        });
        return;
      }

      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(row => Object.values(row).join(',')).join('\n');
      const csv = `${headers}\n${rows}`;

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();

      toast({
        title: 'Export successful',
        description: `${type} exported as CSV`,
      });
    } catch (error: any) {
      toast({
        title: 'Export failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  // Calculate analytics data
// Calculate analytics data with UNIX timestamp conversion
interface MonthlyData {
  month: string;
  income: number;
  expense: number;
  sortKey: number;
}

const monthlyData: MonthlyData[] = transactions.reduce(
  (acc: MonthlyData[], transaction) => {
    const date = new Date(transaction.transaction_date * 1000); // UNIX seconds → ms

    // Generate sortable key YYYYMM (e.g., 202503)
    const sortKey = date.getFullYear() * 100 + (date.getMonth() + 1);

    // Display month name format
    const monthKey = date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

    const existing = acc.find(item => item.month === monthKey);

    if (existing) {
      if (transaction.type === "income") {
        existing.income += Number(transaction.amount);
      } else {
        existing.expense += Number(transaction.amount);
      }
    } else {
      acc.push({
        month: monthKey,
        income: transaction.type === "income" ? Number(transaction.amount) : 0,
        expense: transaction.type === "expense" ? Number(transaction.amount) : 0,
        sortKey,
      });
    }

    return acc;
  },
  []
);

// Sort chronologically
monthlyData.sort((a, b) => a.sortKey - b.sortKey);


  const categoryData = transactions.reduce((acc: any[], transaction) => {
    const existing = acc.find(item => item.name === transaction.category);
    if (existing) {
      existing.value += Number(transaction.amount);
    } else {
      acc.push({
        name: transaction.category,
        value: Number(transaction.amount),
      });
    }
    return acc;
  }, []);

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Reports & Analytics</h2>
          <p className="text-muted-foreground">Visualize and export your budget data</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">${totalIncome.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">${totalExpense.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-success' : 'text-destructive'}`}>
                    ${(totalIncome - totalExpense).toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Monthly Trends
                  </CardTitle>
                  <CardDescription>Income vs Expenses over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{
                    income: { label: "Income", color: "hsl(var(--chart-1))" },
                    expense: { label: "Expense", color: "hsl(var(--chart-2))" },
                  }} className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Line type="monotone" dataKey="income" stroke="hsl(var(--chart-1))" strokeWidth={2} />
                        <Line type="monotone" dataKey="expense" stroke="hsl(var(--chart-2))" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5" />
                    Spending by Category
                  </CardTitle>
                  <CardDescription>Budget allocation across categories</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{}} className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => entry.name}
                          outerRadius={80}
                          fill="hsl(var(--primary))"
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            {/* Export Section */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Transaction Reports
                  </CardTitle>
                  <CardDescription>Export all transaction data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    className="w-full" 
                    onClick={() => generateCSV('transactions')}
                    disabled={generating}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export as CSV
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Deadline Reports
                  </CardTitle>
                  <CardDescription>Export all deadline data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    className="w-full" 
                    onClick={() => generateCSV('deadlines')}
                    disabled={generating}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export as CSV
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
