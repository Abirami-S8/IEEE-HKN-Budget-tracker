import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TrendingUp, TrendingDown, Clock, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DashboardStats {
  actualBalance: number;
  projectedBalance: number;
  totalIncome: number;
  totalExpenses: number;
  upcomingDeadlines: number;
  completedDeadlines: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    actualBalance: 0,
    projectedBalance: 0,
    totalIncome: 0,
    totalExpenses: 0,
    upcomingDeadlines: 0,
    completedDeadlines: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentDeadlines, setRecentDeadlines] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (!profile) {
        toast({
          title: 'Profile not found',
          description: 'Please contact support.',
          variant: 'destructive',
        });
        return;
      }

      // Fetch current academic year
      const { data: academicYear } = await supabase
        .from('academic_years')
        .select('*')
        .eq('is_current', true)
        .single();

      if (!academicYear) {
        // Create default academic year
        const currentYear = new Date().getFullYear();
        const { data: newYear } = await supabase
          .from('academic_years')
          .insert({
            year_label: `${currentYear}-${currentYear + 1}`,
            start_date: new Date(`${currentYear}-09-01`).toISOString(),
            end_date: new Date(`${currentYear + 1}-08-31`).toISOString(),
            is_current: true,
          })
          .select()
          .single();

        if (newYear) {
          await fetchStats(newYear.id);
        }
      } else {
        await fetchStats(academicYear.id);
      }
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: 'Error loading dashboard',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (academicYearId: string) => {
    // Fetch transactions
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user?.id)
      .eq('academic_year_id', academicYearId);

    if (transactions) {
      const completed = transactions.filter(t => t.status === 'completed');
      const income = completed.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
      const expenses = completed.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
      
      const allIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
      const allExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);

      setStats(prev => ({
        ...prev,
        actualBalance: income - expenses,
        projectedBalance: allIncome - allExpenses,
        totalIncome: income,
        totalExpenses: expenses,
      }));
    }

    // Fetch deadlines
    const { data: deadlines } = await supabase
      .from('deadlines')
      .select('*')
      .eq('user_id', user?.id)
      .eq('academic_year_id', academicYearId)
      .order('due_date', { ascending: true })
      .limit(5);

    if (deadlines) {
      const now = Date.now() / 1000;
      const upcoming = deadlines.filter(d => !d.is_completed && d.due_date > now).length;
      const completed = deadlines.filter(d => d.is_completed).length;
      
      setStats(prev => ({
        ...prev,
        upcomingDeadlines: upcoming,
        completedDeadlines: completed,
      }));
      
      setRecentDeadlines(deadlines.filter(d => !d.is_completed).slice(0, 5));
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Welcome Back!</h2>
          <p className="text-muted-foreground">
            Here's an overview of your chapter's finances
          </p>
        </div>

        {/* Balance Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Actual Balance</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.actualBalance.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Completed transactions only</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Projected Balance</CardTitle>
              <TrendingDown className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.projectedBalance.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Including planned transactions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Income</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">${stats.totalIncome.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">This academic year</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">${stats.totalExpenses.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">This academic year</p>
            </CardContent>
          </Card>
        </div>

        {/* Deadlines Overview */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-warning" />
                Upcoming Deadlines
              </CardTitle>
              <CardDescription>Tasks that need your attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.upcomingDeadlines}</div>
              {recentDeadlines.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {recentDeadlines.map(deadline => (
                    <div key={deadline.id} className="flex items-start gap-2 text-sm border-l-2 border-warning pl-2">
                      <div className="flex-1">
                        <p className="font-medium">{deadline.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(deadline.due_date * 1000).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No upcoming deadlines</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                Completed Deadlines
              </CardTitle>
              <CardDescription>Successfully finished tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{stats.completedDeadlines}</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Keep up the great work!
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
