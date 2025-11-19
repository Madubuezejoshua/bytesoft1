import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { TeacherReview } from '@/types';
import { teacherReviewsService } from '@/lib/teacherReviewsService';
import {
  Star,
  MessageCircle,
  User,
  BarChart3,
} from 'lucide-react';

interface TeacherReviewsPanelProps {
  teacherId: string;
  teacherName: string;
  loading?: boolean;
}

export const TeacherReviewsPanel = ({
  teacherId,
  teacherName,
  loading = false,
}: TeacherReviewsPanelProps) => {
  const [reviews, setReviews] = useState<TeacherReview[]>([]);
  const [isLoading, setIsLoading] = useState(loading);
  const [averageRating, setAverageRating] = useState(0);
  const [ratingDistribution, setRatingDistribution] = useState<{
    [rating: number]: number;
  }>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  });

  useEffect(() => {
    if (!teacherId) return;

    setIsLoading(true);

    // Subscribe to real-time reviews
    const unsubscribe = teacherReviewsService.subscribeToTeacherReviews(
      teacherId,
      async reviews => {
        setReviews(
          reviews.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );

        // Calculate average rating
        if (reviews.length > 0) {
          const avgRating = await teacherReviewsService.getAverageRating(
            teacherId
          );
          setAverageRating(avgRating);

          const distribution = await teacherReviewsService.getRatingDistribution(
            teacherId
          );
          setRatingDistribution(distribution);
        }

        setIsLoading(false);
      },
      error => {
        console.error('Error fetching reviews:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [teacherId]);

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
    if (rating >= 4.5) return 'bg-green-100 text-green-800';
    if (rating >= 3.5) return 'bg-blue-100 text-blue-800';
    if (rating >= 2.5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getReviewerBadge = (review: TeacherReview) => {
    if (review.reviewerType === 'student') {
      return (
        <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
          <User className="w-3 h-3 mr-1" />
          Student
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
          <User className="w-3 h-3 mr-1" />
          Coordinator
        </Badge>
      );
    }
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-soft border-0">
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">Reviews for {teacherName}</CardTitle>
                  <CardDescription>
                    {reviews.length} review{reviews.length !== 1 ? 's' : ''} received
                  </CardDescription>
                </div>
              </div>
            </div>

            {reviews.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                {/* Average Rating */}
                <div className={`p-4 rounded-lg ${getRatingColor(averageRating)}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-5 h-5 fill-current" />
                    <span className="text-2xl font-bold">{averageRating}</span>
                    <span className="text-sm">/5</span>
                  </div>
                  <p className="text-sm font-medium">Average Rating</p>
                </div>

                {/* Total Reviews */}
                <div className="p-4 rounded-lg bg-slate-100 text-slate-800">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-2xl font-bold">{reviews.length}</span>
                  </div>
                  <p className="text-sm font-medium">Total Reviews</p>
                </div>

                {/* Top Rating */}
                <div className="p-4 rounded-lg bg-slate-100 text-slate-800">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-5 h-5" />
                    <span className="text-2xl font-bold">
                      {ratingDistribution[5] > 0 ? ratingDistribution[5] : 0}
                    </span>
                  </div>
                  <p className="text-sm font-medium">5-Star Reviews</p>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Rating Distribution Chart */}
      {reviews.length > 0 && (
        <Card className="shadow-soft border-0">
          <CardHeader>
            <CardTitle className="text-base">Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[5, 4, 3, 2, 1].map(rating => {
              const count = ratingDistribution[rating] || 0;
              const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;

              return (
                <div key={rating} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-20">
                    <span className="font-semibold">{rating}</span>
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-amber-400 h-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-12 text-right">
                    <span className="text-sm text-muted-foreground">{count}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      <Card className="shadow-soft border-0">
        <CardHeader>
          <CardTitle className="text-base">Student & Coordinator Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-muted-foreground">Loading reviews...</div>
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageCircle className="w-12 h-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground font-medium">No reviews yet</p>
              <p className="text-sm text-muted-foreground">
                Reviews will appear here once students and coordinators provide feedback
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-4">
                {reviews.map(review => (
                  <div
                    key={review.id}
                    className="border rounded-lg p-4 space-y-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(
                              review.reviewerType === 'student'
                                ? review.studentName || 'Student'
                                : review.coordinatorName || 'Coordinator'
                            )}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">
                              {review.reviewerType === 'student'
                                ? review.studentName || 'Anonymous Student'
                                : review.coordinatorName || 'Anonymous Coordinator'}
                            </span>
                            {getReviewerBadge(review)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(review.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {renderStars(review.rating)}
                      </div>
                    </div>

                    {review.comment && (
                      <div className="bg-slate-50 rounded-md p-3 border border-slate-200">
                        <p className="text-sm text-slate-700 leading-relaxed">
                          {review.comment}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
