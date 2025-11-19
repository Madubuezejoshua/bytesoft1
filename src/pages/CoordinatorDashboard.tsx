import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, BookOpen, Calendar, AlertCircle, Video, TrendingUp, Link as LinkIcon, CheckCircle, Star, Eye, Key } from 'lucide-react';
import { collection, getDocs, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import CreateCourseDialog from '@/components/courses/CreateCourseDialog';
import { CourseManagement } from '@/components/coordinator/CourseManagement';
import MeetingsList from '@/components/meetings/MeetingsList';
import CourseRequestsTab from '@/components/coordinator/CourseRequestsTab';
import RequestStatistics from '@/components/coordinator/RequestStatistics';
import ActivityFeed from '@/components/coordinator/ActivityFeed';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import StatsCard from '@/components/dashboard/StatsCard';
import { SpecialLinksOverview } from '@/components/coordinator/SpecialLinksOverview';
import VerifiedTab from '@/components/coordinator/VerifiedTab';
import { TeacherReviewsPanel } from '@/components/coordinator/TeacherReviewsPanel';
import TeacherDetailsDialog from '@/components/coordinator/TeacherDetailsDialog';
import AIAPIKeyTab from '@/components/coordinator/AIAPIKeyTab';

const CoordinatorDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ students: 0, courses: 0, enrollments: 0, pendingRequests: 0 });
  const [activeTab, setActiveTab] = useState('requests');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedTeacherName, setSelectedTeacherName] = useState<string>('');
  const [teacherDetailsOpen, setTeacherDetailsOpen] = useState(false);

  useEffect(() => {
    if (!user || (user.role !== 'coordinator' && user.role !== 'admin')) {
      navigate('/login');
      return;
    }
    fetchStats();
  }, [user, navigate]);

  const fetchStats = () => {
    const usersUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      setStats((prev) => ({ ...prev, students: snapshot.size }));
      
      // Also fetch teachers separately
      const teachersData = snapshot.docs
        .filter(doc => doc.data().role === 'teacher')
        .map(doc => ({ id: doc.id, ...doc.data() }));
      setTeachers(teachersData);
    });

    const coursesUnsub = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setStats((prev) => ({ ...prev, courses: snapshot.size }));
    });

    const enrollmentsUnsub = onSnapshot(
      collection(db, 'enrollments'),
      (snapshot) => {
        setStats((prev) => ({ ...prev, enrollments: snapshot.size }));
      }
    );

    const requestsUnsub = onSnapshot(
      query(
        collection(db, 'course_requests'),
        where('status', '==', 'pending')
      ),
      (snapshot) => {
        setStats((prev) => ({ ...prev, pendingRequests: snapshot.size }));
      }
    );

    return () => {
      usersUnsub();
      coursesUnsub();
      enrollmentsUnsub();
      requestsUnsub();
    };
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navigationItems = [
    {
      label: 'Course Requests',
      onClick: () => setActiveTab('requests'),
      badge: stats.pendingRequests > 0 ? stats.pendingRequests : undefined,
    },
    {
      label: 'Courses',
      onClick: () => setActiveTab('courses'),
    },
    {
      label: 'Manage',
      onClick: () => setActiveTab('manage'),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title="Coordinator Dashboard"
        userName={user?.name || 'Coordinator'}
        userEmail={user?.email || ''}
        navigationItems={navigationItems}
        onLogout={handleLogout}
        isVerified={user?.isVerified}
      />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mb-12">
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Welcome back!</h2>
            <p className="text-muted-foreground">Manage courses, requests, and platform oversight</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatsCard
              icon={Users}
              label="Total Users"
              value={stats.students}
              iconBgColor="bg-blue-100 dark:bg-blue-900/30"
              iconColor="text-blue-600 dark:text-blue-400"
              gradient
            />

            <StatsCard
              icon={BookOpen}
              label="Total Courses"
              value={stats.courses}
              iconBgColor="bg-emerald-100 dark:bg-emerald-900/30"
              iconColor="text-emerald-600 dark:text-emerald-400"
              gradient
            />

            <StatsCard
              icon={TrendingUp}
              label="Total Enrollments"
              value={stats.enrollments}
              iconBgColor="bg-amber-100 dark:bg-amber-900/30"
              iconColor="text-amber-600 dark:text-amber-400"
              gradient
            />

            <StatsCard
              icon={AlertCircle}
              label="Pending Requests"
              value={stats.pendingRequests}
              iconBgColor="bg-rose-100 dark:bg-rose-900/30"
              iconColor="text-rose-600 dark:text-rose-400"
              gradient
            />
          </div>
        </div>

        <div className="mb-12">
          <RequestStatistics />
        </div>

        <div className="grid grid-cols-1 mb-8">
          <ActivityFeed coordinatorId={user?.id || ''} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="requests">
              Course Requests
              {stats.pendingRequests > 0 && (
                <span className="ml-2 bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-1 rounded-full">
                  {stats.pendingRequests}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="verified">
              <CheckCircle className="w-4 h-4 mr-2" />
              Verified
            </TabsTrigger>
            <TabsTrigger value="reviews">
              <Star className="w-4 h-4 mr-2" />
              Teacher Reviews
            </TabsTrigger>
            <TabsTrigger value="courses">Courses</TabsTrigger>
            <TabsTrigger value="manage">Manage Courses</TabsTrigger>
            <TabsTrigger value="ai-api">
              <Key className="w-4 h-4 mr-2" />
              AI API
            </TabsTrigger>
            <TabsTrigger value="meetings">Meetings</TabsTrigger>
            <TabsTrigger value="special-links">Special Links</TabsTrigger>
          </TabsList>

          <TabsContent value="requests">
            <CourseRequestsTab coordinatorId={user?.id || ''} coordinatorName={user?.name || ''} />
          </TabsContent>

          <TabsContent value="verified">
            <VerifiedTab />
          </TabsContent>

          <TabsContent value="reviews">
            <div className="space-y-6">
              {teachers.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>No Teachers Found</CardTitle>
                    <CardDescription>There are currently no teachers on the platform.</CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Select a Teacher</CardTitle>
                      <CardDescription>Choose a teacher to view their student reviews</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {teachers.map(teacher => (
                          <div
                            key={teacher.id}
                            className="p-4 rounded-lg border-2 border-border hover:border-primary/50 transition-all"
                          >
                            <button
                              onClick={() => {
                                setSelectedTeacherId(teacher.id);
                                setSelectedTeacherName(teacher.name);
                              }}
                              className="text-left w-full"
                            >
                              <h3 className="font-semibold text-foreground">{teacher.name}</h3>
                              <p className="text-sm text-muted-foreground">{teacher.email}</p>
                              {teacher.classesHeld !== undefined && (
                                <div className="mt-2 flex items-center gap-1 text-sm">
                                  <span className="text-muted-foreground">Classes:</span>
                                  <span className="font-semibold">{teacher.classesHeld}</span>
                                </div>
                              )}
                            </button>
                            <Button
                              onClick={() => {
                                setSelectedTeacherId(teacher.id);
                                setSelectedTeacherName(teacher.name);
                                setTeacherDetailsOpen(true);
                              }}
                              variant="outline"
                              size="sm"
                              className="w-full mt-3 gap-2"
                            >
                              <Eye className="w-4 h-4" />
                              View Details
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {selectedTeacherId && (
                    <>
                      <TeacherReviewsPanel
                        teacherId={selectedTeacherId}
                        teacherName={selectedTeacherName}
                      />
                      <TeacherDetailsDialog
                        teacherId={selectedTeacherId}
                        isOpen={teacherDetailsOpen}
                        onClose={() => setTeacherDetailsOpen(false)}
                      />
                    </>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="courses">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>All Courses</CardTitle>
                    <CardDescription>Browse and manage all platform courses</CardDescription>
                  </div>
                  <CreateCourseDialog teacherId={user?.id || ''} teacherName={user?.name || ''} onCourseCreated={fetchStats} />
                </div>
              </CardHeader>
              <CardContent>
                <Button onClick={() => navigate('/courses')} variant="outline" className="w-full">
                  View All Courses
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manage">
            <CourseManagement />
          </TabsContent>

          <TabsContent value="ai-api">
            <AIAPIKeyTab />
          </TabsContent>

          <TabsContent value="meetings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  All Meetings
                </CardTitle>
                <CardDescription>View and join all scheduled meetings</CardDescription>
              </CardHeader>
              <CardContent>
                <MeetingsList userRole="coordinator" />
                <p className="text-xs text-muted-foreground mt-4">Showing all scheduled meetings across the platform.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="special-links">
            <SpecialLinksOverview />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CoordinatorDashboard;
