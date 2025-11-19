import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User, Calendar, BookOpen, BarChart3, Star, Mail, Phone, Users, CheckCircle2, Search, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit, startAfter, QueryConstraint, DocumentSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { teacherReviewsService } from '@/lib/teacherReviewsService';
import { User as UserType, TeacherReview, Enrollment } from '@/types';
import { toast } from 'sonner';

interface TeacherDetailsDialogProps {
  teacherId: string;
  isOpen: boolean;
  onClose: () => void;
}

const STUDENTS_PAGE_SIZE = 10;

const TeacherDetailsDialog = ({ teacherId, isOpen, onClose }: TeacherDetailsDialogProps) => {
  const [teacher, setTeacher] = useState<UserType | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [reviews, setReviews] = useState<TeacherReview[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [ratingDistribution, setRatingDistribution] = useState<{ [key: number]: number }>({
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(0);
  const [paginatedStudents, setPaginatedStudents] = useState<Enrollment[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreStudents, setHasMoreStudents] = useState(true);
  const [lastDocSnapshot, setLastDocSnapshot] = useState<DocumentSnapshot | null>(null);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'verified' | 'pending'>('all');
  const [filteredStudents, setFilteredStudents] = useState<Enrollment[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && teacherId) {
      loadTeacherDetails();
    }
  }, [isOpen, teacherId]);

  // Handle search and filter updates
  useEffect(() => {
    applySearchAndFilter();
  }, [searchQuery, selectedFilter, enrollments]);

  const applySearchAndFilter = () => {
    let filtered = enrollments;

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.studentName.toLowerCase().includes(query) ||
        (e.studentEmail && e.studentEmail.toLowerCase().includes(query))
      );
    }

    // Apply verification filter
    if (selectedFilter === 'verified') {
      filtered = filtered.filter(e => e.verified);
    } else if (selectedFilter === 'pending') {
      filtered = filtered.filter(e => !e.verified);
    }

    setFilteredStudents(filtered);
    setCurrentPage(0);
  };

  const loadTeacherDetails = async () => {
    setLoading(true);
    try {
      // Fetch teacher data - only essential fields
      const teacherDoc = await getDocs(
        query(collection(db, 'users'))
      );

      const teacherData = teacherDoc.docs
        .find(doc => doc.id === teacherId)
        ?.data() as UserType;

      if (teacherData) {
        setTeacher({ ...teacherData, id: teacherId });
      }

      // Fetch all enrollments for this teacher
      const enrollmentsSnapshot = await getDocs(
        query(
          collection(db, 'enrollments'),
          where('teacherId', '==', teacherId)
        )
      );
      const enrollmentsData = enrollmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Enrollment[];

      setEnrollments(enrollmentsData);
      setTotalStudents(enrollmentsData.length);
      setFilteredStudents(enrollmentsData);

      // Load first page of students
      if (enrollmentsData.length > 0) {
        setPaginatedStudents(enrollmentsData.slice(0, STUDENTS_PAGE_SIZE));
        setHasMoreStudents(enrollmentsData.length > STUDENTS_PAGE_SIZE);
      }

      // Fetch reviews
      setReviewsLoading(true);
      const reviewsData = await teacherReviewsService.getTeacherReviews(teacherId);
      setReviews(reviewsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

      // Calculate rating metrics
      if (reviewsData.length > 0) {
        const avgRating = await teacherReviewsService.getAverageRating(teacherId);
        setAverageRating(avgRating);

        const distribution = await teacherReviewsService.getRatingDistribution(teacherId);
        setRatingDistribution(distribution);
      }
    } catch (error) {
      console.error('Error loading teacher details:', error);
      toast.error('Failed to load teacher details');
    } finally {
      setLoading(false);
      setReviewsLoading(false);
    }
  };

  const goToNextPage = () => {
    const start = (currentPage + 1) * STUDENTS_PAGE_SIZE;
    const end = start + STUDENTS_PAGE_SIZE;
    if (start < filteredStudents.length) {
      setPaginatedStudents(filteredStudents.slice(start, end));
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 0) {
      const start = (currentPage - 1) * STUDENTS_PAGE_SIZE;
      const end = start + STUDENTS_PAGE_SIZE;
      setPaginatedStudents(filteredStudents.slice(start, end));
      setCurrentPage(currentPage - 1);
    }
  };

  const totalPages = Math.ceil(filteredStudents.length / STUDENTS_PAGE_SIZE);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            className={`w-4 h-4 ${
              i <= rating
                ? 'fill-amber-400 text-amber-400'
                : 'text-muted-foreground'
            }`}
          />
        ))}
      </div>
    );
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'bg-green-100 text-green-800 border-green-300';
    if (rating >= 3.5) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (rating >= 2.5) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  const getUniqueStudents = () => {
    return new Set(enrollments.map(e => e.studentId)).size;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Teacher Details</DialogTitle>
          <DialogDescription>View comprehensive information about this teacher</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading teacher details...</p>
            <p className="text-xs text-muted-foreground">This may take a moment while we fetch enrollment and review data.</p>
          </div>
        ) : !teacher ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <p className="text-muted-foreground font-medium">Failed to load teacher</p>
            <p className="text-xs text-muted-foreground">The teacher could not be found. Please try again.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Teacher Card */}
            <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
              <CardHeader>
                <div className="flex items-start gap-6">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={teacher.profilePicture} alt={teacher.name} />
                    <AvatarFallback className="bg-primary/20 text-primary text-lg">
                      {getInitials(teacher.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-3xl font-bold text-foreground">{teacher.name}</h2>
                        <p className="text-muted-foreground mt-1">{teacher.email}</p>
                      </div>
                      {teacher.isVerified && (
                        <Badge className="bg-green-100 text-green-800 border-green-300">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Classes Held</p>
                        <p className="text-2xl font-bold text-primary">{teacher.classesHeld || 0}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Students</p>
                        <p className="text-2xl font-bold text-primary">{getUniqueStudents()}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Reviews</p>
                        <p className="text-2xl font-bold text-primary">{reviews.length}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Avg Rating</p>
                        <div className="flex items-center gap-1">
                          <p className="text-2xl font-bold text-primary">{averageRating.toFixed(1)}</p>
                          <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="info" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">Info</span>
                </TabsTrigger>
                <TabsTrigger value="students" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Students</span>
                </TabsTrigger>
                <TabsTrigger value="performance" className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Performance</span>
                </TabsTrigger>
                <TabsTrigger value="reviews" className="flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  <span className="hidden sm:inline">Reviews</span>
                </TabsTrigger>
              </TabsList>

              {/* Info Tab */}
              <TabsContent value="info" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Personal Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                        <p className="text-base font-medium">{teacher.name}</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Email</label>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <a href={`mailto:${teacher.email}`} className="text-base font-medium text-primary hover:underline">
                            {teacher.email}
                          </a>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Account Created</label>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <p className="text-base font-medium">
                            {new Date(teacher.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Verification Status</label>
                        <div className="flex items-center gap-2">
                          {teacher.isVerified ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              <p className="text-base font-medium text-green-600">Verified</p>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                              <p className="text-base font-medium text-muted-foreground">Unverified</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Students Tab */}
              <TabsContent value="students" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Enrolled Students</CardTitle>
                    <CardDescription>
                      {totalStudents} students enrolled in courses taught by this teacher
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {enrollments.length === 0 ? (
                      <div className="text-center py-12">
                        <AlertCircle className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                        <p className="text-muted-foreground font-medium">No students enrolled</p>
                        <p className="text-sm text-muted-foreground">This teacher currently has no enrolled students.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Search and Filter */}
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              placeholder="Search by name or email..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                          <div className="flex gap-2">
                            {(['all', 'verified', 'pending'] as const).map(filter => (
                              <Button
                                key={filter}
                                variant={selectedFilter === filter ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedFilter(filter)}
                              >
                                {filter.charAt(0).toUpperCase() + filter.slice(1)}
                              </Button>
                            ))}
                          </div>
                        </div>

                        {/* Results Info */}
                        <div className="text-sm text-muted-foreground">
                          Showing {paginatedStudents.length > 0 ? currentPage * STUDENTS_PAGE_SIZE + 1 : 0} to{' '}
                          {Math.min((currentPage + 1) * STUDENTS_PAGE_SIZE, filteredStudents.length)} of{' '}
                          {filteredStudents.length} results
                        </div>

                        {/* Students Table */}
                        {filteredStudents.length === 0 ? (
                          <div className="text-center py-8">
                            <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                            <p className="text-muted-foreground">No students found matching your search</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="border-b bg-muted/50">
                                <tr>
                                  <th className="text-left py-3 px-3 font-semibold">Student Name</th>
                                  <th className="text-left py-3 px-3 font-semibold">Course</th>
                                  <th className="text-left py-3 px-3 font-semibold">Enrolled Date</th>
                                  <th className="text-left py-3 px-3 font-semibold">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {paginatedStudents.map((enrollment, idx) => (
                                <tr key={idx} className="border-b hover:bg-muted/50 transition-colors">
                                  <td className="py-3 px-3">
                                    <div className="flex items-center gap-2">
                                      <Avatar className="w-6 h-6">
                                        <AvatarFallback className="text-xs bg-primary/10">
                                          {enrollment.studentName
                                            .split(' ')
                                            .map(n => n[0])
                                            .join('')
                                            .toUpperCase()
                                            .slice(0, 2)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="font-medium">{enrollment.studentName}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3">
                                    <span className="line-clamp-1">{enrollment.courseName}</span>
                                  </td>
                                  <td className="py-3 px-3">
                                    {new Date(enrollment.enrolledAt).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    })}
                                  </td>
                                  <td className="py-3 px-3">
                                    <Badge
                                      variant="outline"
                                      className={
                                        enrollment.verified
                                          ? 'bg-green-100 text-green-800 border-green-300'
                                          : 'bg-yellow-100 text-yellow-800 border-yellow-300'
                                      }
                                    >
                                      {enrollment.verified ? 'Verified' : 'Pending'}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          </div>
                        )}

                        {/* Pagination Controls */}
                        {filteredStudents.length > STUDENTS_PAGE_SIZE && (
                          <div className="flex items-center justify-between pt-4 border-t">
                            <div className="text-sm text-muted-foreground">
                              Page {currentPage + 1} of {totalPages}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={goToPreviousPage}
                                disabled={currentPage === 0}
                              >
                                <ChevronLeft className="w-4 h-4" />
                                Previous
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={goToNextPage}
                                disabled={currentPage >= totalPages - 1}
                              >
                                Next
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Performance Tab */}
              <TabsContent value="performance" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Teaching Performance</CardTitle>
                    <CardDescription>Class activity and student metrics</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Classes Held Counter */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="pt-6">
                          <div className="text-center space-y-2">
                            <BookOpen className="w-8 h-8 text-blue-600 mx-auto" />
                            <p className="text-3xl font-bold text-blue-600">{teacher.classesHeld || 0}</p>
                            <p className="text-sm text-muted-foreground">Classes Held</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-purple-50 border-purple-200">
                        <CardContent className="pt-6">
                          <div className="text-center space-y-2">
                            <Users className="w-8 h-8 text-purple-600 mx-auto" />
                            <p className="text-3xl font-bold text-purple-600">{getUniqueStudents()}</p>
                            <p className="text-sm text-muted-foreground">Unique Students</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-amber-50 border-amber-200">
                        <CardContent className="pt-6">
                          <div className="text-center space-y-2">
                            <Star className="w-8 h-8 text-amber-600 mx-auto" />
                            <p className="text-3xl font-bold text-amber-600">{averageRating.toFixed(1)}</p>
                            <p className="text-sm text-muted-foreground">Average Rating</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Rating Distribution */}
                    {reviews.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="font-semibold">Rating Distribution</h3>
                        {[5, 4, 3, 2, 1].map(rating => {
                          const count = ratingDistribution[rating] || 0;
                          const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;

                          return (
                            <div key={rating} className="flex items-center gap-3">
                              <div className="flex items-center gap-1 w-16">
                                <span className="font-semibold">{rating}</span>
                                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                              </div>
                              <div className="flex-1">
                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-amber-400 h-full transition-all"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                              <div className="w-8 text-right text-sm text-muted-foreground">
                                {count}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Reviews Tab */}
              <TabsContent value="reviews" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Student Reviews</CardTitle>
                    <CardDescription>
                      {reviews.length} review{reviews.length !== 1 ? 's' : ''} received
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {reviewsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mr-2" />
                        <p className="text-muted-foreground">Loading reviews...</p>
                      </div>
                    ) : reviews.length === 0 ? (
                      <div className="text-center py-12">
                        <Star className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                        <p className="text-muted-foreground font-medium">No reviews yet</p>
                        <p className="text-sm text-muted-foreground">Students and coordinators will see reviews here once they submit them.</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[500px] pr-4">
                        <div className="space-y-4">
                          {reviews.map(review => (
                            <div
                              key={review.id}
                              className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-sm">
                                      {review.reviewerType === 'student'
                                        ? review.studentName || 'Anonymous'
                                        : review.coordinatorName || 'Coordinator'}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={
                                        review.reviewerType === 'student'
                                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                                          : 'bg-purple-100 text-purple-800 border-purple-300'
                                      }
                                    >
                                      {review.reviewerType === 'student' ? 'Student' : 'Coordinator'}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(review.createdAt).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </p>
                                </div>
                                <div>{renderStars(review.rating)}</div>
                              </div>

                              {review.comment && (
                                <p className="text-sm text-muted-foreground bg-muted rounded-md p-3 leading-relaxed">
                                  {review.comment}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TeacherDetailsDialog;
