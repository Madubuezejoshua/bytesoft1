import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  getDocs,
  serverTimestamp,
  getDoc,
  doc,
  Firestore,
} from 'firebase/firestore';
import { db } from './firebase';
import { TeacherReview } from '@/types';

export const teacherReviewsService = {
  /**
   * Subscribe to all reviews for a specific teacher (real-time)
   * @param teacherId - The teacher's Firebase UID
   * @param onSuccess - Callback when reviews are loaded/updated
   * @param onError - Callback on error
   * @returns Unsubscribe function
   */
  subscribeToTeacherReviews(
    teacherId: string,
    onSuccess: (reviews: TeacherReview[]) => void,
    onError: (error: Error) => void
  ): () => void {
    try {
      const reviewsQuery = query(
        collection(db, 'teacher_reviews'),
        where('teacherId', '==', teacherId)
      );

      return onSnapshot(
        reviewsQuery,
        snapshot => {
          const reviews = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as TeacherReview[];
          onSuccess(reviews);
        },
        error => {
          console.error('Error fetching teacher reviews:', error);
          onError(error);
        }
      );
    } catch (error) {
      console.error('Error setting up reviews listener:', error);
      onError(error as Error);
      return () => {};
    }
  },

  /**
   * Get all reviews for a specific teacher (one-time fetch)
   * @param teacherId - The teacher's Firebase UID
   * @returns Promise<TeacherReview[]>
   */
  async getTeacherReviews(teacherId: string): Promise<TeacherReview[]> {
    try {
      const reviewsQuery = query(
        collection(db, 'teacher_reviews'),
        where('teacherId', '==', teacherId)
      );
      const snapshot = await getDocs(reviewsQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as TeacherReview[];
    } catch (error) {
      console.error('Error fetching teacher reviews:', error);
      return [];
    }
  },

  /**
   * Get reviews filtered by reviewer type
   * @param teacherId - The teacher's Firebase UID
   * @param reviewerType - 'student' | 'coordinator'
   * @returns Promise<TeacherReview[]>
   */
  async getTeacherReviewsByType(
    teacherId: string,
    reviewerType: 'student' | 'coordinator'
  ): Promise<TeacherReview[]> {
    try {
      const reviewsQuery = query(
        collection(db, 'teacher_reviews'),
        where('teacherId', '==', teacherId),
        where('reviewerType', '==', reviewerType)
      );
      const snapshot = await getDocs(reviewsQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as TeacherReview[];
    } catch (error) {
      console.error('Error fetching reviews by type:', error);
      return [];
    }
  },

  /**
   * Create a new review for a teacher
   * @param review - Review data
   * @returns Promise<string> - The review ID
   */
  async createReview(review: Omit<TeacherReview, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'teacher_reviews'), {
        ...review,
        createdAt: new Date().toISOString(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating review:', error);
      throw error;
    }
  },

  /**
   * Get average rating for a teacher
   * @param teacherId - The teacher's Firebase UID
   * @returns Promise<number>
   */
  async getAverageRating(teacherId: string): Promise<number> {
    try {
      const reviews = await this.getTeacherReviews(teacherId);
      if (reviews.length === 0) return 0;
      const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
      return Math.round((sum / reviews.length) * 10) / 10; // Round to 1 decimal place
    } catch (error) {
      console.error('Error calculating average rating:', error);
      return 0;
    }
  },

  /**
   * Get rating distribution for a teacher
   * @param teacherId - The teacher's Firebase UID
   * @returns Promise<{[rating: number]: number}> - Count of reviews per rating
   */
  async getRatingDistribution(teacherId: string): Promise<{
    [rating: number]: number;
  }> {
    try {
      const reviews = await this.getTeacherReviews(teacherId);
      const distribution: { [rating: number]: number } = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      };

      reviews.forEach(review => {
        if (review.rating >= 1 && review.rating <= 5) {
          distribution[review.rating]++;
        }
      });

      return distribution;
    } catch (error) {
      console.error('Error calculating rating distribution:', error);
      return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    }
  },

  /**
   * Get total review count for a teacher
   * @param teacherId - The teacher's Firebase UID
   * @returns Promise<number>
   */
  async getReviewCount(teacherId: string): Promise<number> {
    try {
      const reviews = await this.getTeacherReviews(teacherId);
      return reviews.length;
    } catch (error) {
      console.error('Error getting review count:', error);
      return 0;
    }
  },

  /**
   * Subscribe to reviews for multiple teachers
   * @param teacherIds - Array of teacher IDs
   * @param onSuccess - Callback with map of teacherId -> reviews
   * @param onError - Callback on error
   * @returns Unsubscribe function
   */
  subscribeToMultipleTeacherReviews(
    teacherIds: string[],
    onSuccess: (reviewsMap: Map<string, TeacherReview[]>) => void,
    onError: (error: Error) => void
  ): () => void {
    const unsubscribers: (() => void)[] = [];

    if (teacherIds.length === 0) {
      onSuccess(new Map());
      return () => {
        unsubscribers.forEach(unsub => unsub());
      };
    }

    let reviewsMap = new Map<string, TeacherReview[]>();
    let completedListeners = 0;

    teacherIds.forEach(teacherId => {
      const unsubscribe = this.subscribeToTeacherReviews(
        teacherId,
        reviews => {
          reviewsMap.set(teacherId, reviews);
          completedListeners++;
          if (completedListeners === teacherIds.length) {
            onSuccess(new Map(reviewsMap));
          }
        },
        error => {
          onError(error);
        }
      );
      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  },
};
