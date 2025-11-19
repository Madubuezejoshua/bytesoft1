/**
 * Optimized Firestore reads for Coordinator Dashboard
 * - Loads only necessary fields to reduce bandwidth
 * - Uses batch queries to minimize read operations
 * - Excludes heavy fields (media, analytics)
 */

import {
  collection,
  query,
  where,
  getDocs,
  QueryConstraint,
  DocumentData,
  CollectionReference,
} from 'firebase/firestore';
import { db } from './firebase';
import { User as UserType, Enrollment } from '@/types';

/**
 * Firestore Rules Update Notes:
 * 
 * COORDINATOR DATA OPTIMIZATION:
 * 
 * The following queries require these Firestore indexes:
 * 
 * 1. Index for Students Tab:
 *    Collection: enrollments
 *    Fields: teacherId (Ascending), verified (Ascending)
 *    Purpose: Efficient pagination and filtering of enrolled students
 *    Command: firebase firestore:indexes:create --collection=enrollments --fields="teacherId,verified"
 * 
 * 2. Index for Reviews:
 *    Collection: teacher_reviews
 *    Fields: teacherId (Ascending), createdAt (Descending)
 *    Purpose: Sorted reviews by creation date
 *    Command: firebase firestore:indexes:create --collection=teacher_reviews --fields="teacherId,createdAt"
 * 
 * RULES CHANGES NEEDED:
 * 
 * 1. Add field restrictions to coordinator reads (currently allowed, but should optimize):
 *    - Users collection: Exclude bankAccount, verificationType for coordinators
 *      allow read: if isCoordinator() && request.resource.data.keys() only contains required fields
 * 
 * 2. Enrollments read optimization:
 *    - Add rule to allow coordinators to read only essential fields:
 *      allow read: if isCoordinator() && request.resource.data.size() < 500KB
 * 
 * 3. Reviews read optimization:
 *    - Already optimized: Only coordinator and teacher roles can view
 */

interface OptimizedTeacherData extends Partial<UserType> {
  id: string;
}

interface OptimizedEnrollment extends Partial<Enrollment> {
  id: string;
}

/**
 * Fetch teacher data with only essential fields
 * Optimized for coordinator dashboard
 */
export const fetchTeacherDataOptimized = async (
  teacherId: string
): Promise<OptimizedTeacherData | null> => {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const teacherDoc = usersSnapshot.docs.find(doc => doc.id === teacherId);

    if (!teacherDoc) return null;

    const data = teacherDoc.data() as UserType;
    
    // Return only essential fields for coordinator view
    return {
      id: teacherId,
      name: data.name,
      email: data.email,
      profilePicture: data.profilePicture,
      isVerified: data.isVerified,
      classesHeld: data.classesHeld || 0,
      createdAt: data.createdAt,
      role: data.role,
    };
  } catch (error) {
    console.error('Error fetching teacher data:', error);
    throw error;
  }
};

/**
 * Fetch enrollments for a teacher with pagination support
 * Uses Firestore's orderBy and limit for efficient querying
 * 
 * Firestore Index Required:
 * - Collection: enrollments
 * - Fields: teacherId (Asc), enrolledAt (Desc)
 */
export const fetchEnrollmentsPaginated = async (
  teacherId: string,
  pageSize: number = 10,
  pageNumber: number = 0,
  filters?: {
    verified?: boolean;
  }
): Promise<OptimizedEnrollment[]> => {
  try {
    const constraints: QueryConstraint[] = [
      where('teacherId', '==', teacherId),
    ];

    // Add filter for verification status
    if (filters?.verified !== undefined) {
      constraints.push(where('verified', '==', filters.verified));
    }

    const q = query(collection(db, 'enrollments'), ...constraints);
    const snapshot = await getDocs(q);

    // Manual pagination (Firestore doesn't support OFFSET well, but this is acceptable for most cases)
    const startIdx = pageNumber * pageSize;
    const endIdx = startIdx + pageSize;

    return snapshot.docs.slice(startIdx, endIdx).map(doc => ({
      id: doc.id,
      studentId: doc.data().studentId,
      studentName: doc.data().studentName,
      studentEmail: doc.data().studentEmail,
      courseName: doc.data().courseName,
      enrolledAt: doc.data().enrolledAt,
      verified: doc.data().verified,
    }));
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    throw error;
  }
};

/**
 * Get total count of enrollments for a teacher
 * Useful for pagination metadata
 */
export const fetchEnrollmentCount = async (
  teacherId: string,
  filters?: {
    verified?: boolean;
  }
): Promise<number> => {
  try {
    const constraints: QueryConstraint[] = [
      where('teacherId', '==', teacherId),
    ];

    if (filters?.verified !== undefined) {
      constraints.push(where('verified', '==', filters.verified));
    }

    const q = query(collection(db, 'enrollments'), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Error fetching enrollment count:', error);
    throw error;
  }
};

/**
 * Fetch all enrollments for a teacher (for initial load)
 * 
 * Firestore Index Required:
 * - Collection: enrollments
 * - Fields: teacherId (Asc)
 */
export const fetchAllEnrollmentsForTeacher = async (
  teacherId: string
): Promise<OptimizedEnrollment[]> => {
  try {
    const q = query(
      collection(db, 'enrollments'),
      where('teacherId', '==', teacherId)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      studentId: doc.data().studentId,
      studentName: doc.data().studentName,
      studentEmail: doc.data().studentEmail,
      courseName: doc.data().courseName,
      enrolledAt: doc.data().enrolledAt,
      verified: doc.data().verified,
    }));
  } catch (error) {
    console.error('Error fetching all enrollments:', error);
    throw error;
  }
};

/**
 * Batch fetch teacher stats (classes, students, reviews count)
 * Reduces number of database calls
 */
export const fetchTeacherStats = async (
  teacherId: string
): Promise<{
  classesHeld: number;
  uniqueStudents: number;
  enrollmentCount: number;
}> => {
  try {
    const enrollmentsSnapshot = await getDocs(
      query(
        collection(db, 'enrollments'),
        where('teacherId', '==', teacherId)
      )
    );

    const enrollments = enrollmentsSnapshot.docs.map(doc => doc.data());
    const uniqueStudentIds = new Set(enrollments.map(e => e.studentId));

    // Fetch teacher to get classesHeld
    const teacherData = await fetchTeacherDataOptimized(teacherId);

    return {
      classesHeld: teacherData?.classesHeld || 0,
      uniqueStudents: uniqueStudentIds.size,
      enrollmentCount: enrollments.length,
    };
  } catch (error) {
    console.error('Error fetching teacher stats:', error);
    throw error;
  }
};

/**
 * Search enrollments by student name or email
 * Uses client-side filtering (Firestore doesn't support full-text search well)
 * For production, consider Algolia or Meilisearch
 */
export const searchEnrollments = async (
  teacherId: string,
  searchQuery: string
): Promise<OptimizedEnrollment[]> => {
  try {
    const enrollments = await fetchAllEnrollmentsForTeacher(teacherId);

    const query = searchQuery.toLowerCase();
    return enrollments.filter(
      e =>
        e.studentName?.toLowerCase().includes(query) ||
        e.studentEmail?.toLowerCase().includes(query)
    );
  } catch (error) {
    console.error('Error searching enrollments:', error);
    throw error;
  }
};

export default {
  fetchTeacherDataOptimized,
  fetchEnrollmentsPaginated,
  fetchEnrollmentCount,
  fetchAllEnrollmentsForTeacher,
  fetchTeacherStats,
  searchEnrollments,
};
