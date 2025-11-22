import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Clock, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { z } from 'zod';

const deadlineSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  due_date: z.number(),
});

interface Deadline {
  id: string;
  title: string;
  description: string;
  due_date: number;
  is_completed: boolean;
}

export default function Deadlines() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);
  const [academicYearId, setAcademicYearId] = useState<string>('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (user) {
      fetchAcademicYear();
    }
  }, [user]);

  useEffect(() => {
    if (academicYearId) {
      fetchDeadlines();
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

  const fetchDeadlines = async () => {
    try {
      const { data, error } = await supabase
        .from('deadlines')
        .select('*')
        .eq('user_id', user?.id)
        .eq('academic_year_id', academicYearId)
        .order('due_date', { ascending: true });

      if (error) throw error;
      setDeadlines(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading deadlines',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const dueDate = new Date(formData.due_date).getTime() / 1000;
      
      const validatedData = deadlineSchema.parse({
        ...formData,
        due_date: dueDate,
      });

      if (editingDeadline) {
        const { error } = await supabase
          .from('deadlines')
          .update({
            ...validatedData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingDeadline.id);

        if (error) throw error;

        toast({
          title: 'Deadline updated',
          description: 'Your deadline has been updated successfully.',
        });
      } else {
        const insertData = {
          title: validatedData.title,
          description: validatedData.description,
          due_date: validatedData.due_date,
          user_id: user?.id!,
          academic_year_id: academicYearId,
        };

        const { error } = await supabase
          .from('deadlines')
          .insert([insertData]);

        if (error) throw error;

        toast({
          title: 'Deadline added',
          description: 'Your deadline has been added successfully.',
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchDeadlines();
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

  const handleEdit = (deadline: Deadline) => {
    setEditingDeadline(deadline);
    setFormData({
      title: deadline.title,
      description: deadline.description || '',
      due_date: new Date(deadline.due_date * 1000).toISOString().split('T')[0],
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this deadline?')) return;

    try {
      const { error } = await supabase
        .from('deadlines')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Deadline deleted',
        description: 'The deadline has been deleted successfully.',
      });

      fetchDeadlines();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const toggleComplete = async (deadline: Deadline) => {
    try {
      const { error } = await supabase
        .from('deadlines')
        .update({ is_completed: !deadline.is_completed })
        .eq('id', deadline.id);

      if (error) throw error;

      fetchDeadlines();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setEditingDeadline(null);
    setFormData({
      title: '',
      description: '',
      due_date: new Date().toISOString().split('T')[0],
    });
  };

  const upcomingDeadlines = deadlines.filter(d => !d.is_completed);
  const completedDeadlines = deadlines.filter(d => d.is_completed);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Deadlines</h2>
            <p className="text-muted-foreground">Keep track of important dates</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Deadline
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingDeadline ? 'Edit' : 'Add'} Deadline</DialogTitle>
                <DialogDescription>
                  {editingDeadline ? 'Update' : 'Create'} a deadline to track
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Submit grant application"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="Additional details about this deadline..."
                  />
                </div>

                <DialogFooter>
                  <Button type="submit">
                    {editingDeadline ? 'Update' : 'Add'} Deadline
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Upcoming Deadlines */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-warning" />
                Upcoming ({upcomingDeadlines.length})
              </CardTitle>
              <CardDescription>Deadlines that need your attention</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4">Loading...</div>
              ) : upcomingDeadlines.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No upcoming deadlines
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingDeadlines.map((deadline) => {
                    const dueDate = new Date(deadline.due_date * 1000);
                    const isOverdue = dueDate < new Date();
                    const daysUntil = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

                    return (
                      <div key={deadline.id} className="flex items-start gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <Checkbox
                          checked={deadline.is_completed}
                          onCheckedChange={() => toggleComplete(deadline)}
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">{deadline.title}</p>
                              {deadline.description && (
                                <p className="text-sm text-muted-foreground">{deadline.description}</p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => handleEdit(deadline)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(deadline.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={isOverdue ? 'destructive' : 'secondary'}>
                              {dueDate.toLocaleDateString()}
                            </Badge>
                            {!isOverdue && daysUntil <= 7 && (
                              <span className="text-xs text-warning">
                                {daysUntil === 0 ? 'Due today' : `${daysUntil} days left`}
                              </span>
                            )}
                            {isOverdue && (
                              <span className="text-xs text-destructive">Overdue</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Completed Deadlines */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                Completed ({completedDeadlines.length})
              </CardTitle>
              <CardDescription>Successfully finished tasks</CardDescription>
            </CardHeader>
            <CardContent>
              {completedDeadlines.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No completed deadlines yet
                </div>
              ) : (
                <div className="space-y-4">
                  {completedDeadlines.map((deadline) => (
                    <div key={deadline.id} className="flex items-start gap-3 p-4 border rounded-lg bg-muted/30">
                      <Checkbox
                        checked={deadline.is_completed}
                        onCheckedChange={() => toggleComplete(deadline)}
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium line-through text-muted-foreground">{deadline.title}</p>
                            {deadline.description && (
                              <p className="text-sm text-muted-foreground">{deadline.description}</p>
                            )}
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(deadline.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Badge variant="outline">
                          {new Date(deadline.due_date * 1000).toLocaleDateString()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
