import {
  doc,
  updateDoc,
  getDoc,
  increment,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

export const teacherClassService = {
  /**
   * Increment the number of classes held for a teacher
   * @param teacherId - The teacher's Firebase UID
   * @returns Promise<void>
   */
  async incrementClassesHeld(teacherId: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', teacherId);
      await updateDoc(userRef, {
        classesHeld: increment(1),
      });
    } catch (error) {
      console.error('Error incrementing classes held:', error);
      throw error;
    }
  },

  /**
   * Set the exact number of classes held for a teacher
   * @param teacherId - The teacher's Firebase UID
   * @param count - The exact count of classes
   * @returns Promise<void>
   */
  async setClassesHeld(teacherId: string, count: number): Promise<void> {
    try {
      const userRef = doc(db, 'users', teacherId);
      await updateDoc(userRef, {
        classesHeld: count,
      });
    } catch (error) {
      console.error('Error setting classes held:', error);
      throw error;
    }
  },

  /**
   * Get the number of classes held for a teacher
   * @param teacherId - The teacher's Firebase UID
   * @returns Promise<number>
   */
  async getClassesHeld(teacherId: string): Promise<number> {
    try {
      const userRef = doc(db, 'users', teacherId);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        return 0;
      }
      return userDoc.data().classesHeld || 0;
    } catch (error) {
      console.error('Error getting classes held:', error);
      return 0;
    }
  },

  /**
   * Batch update classes held for multiple teachers
   * Useful for bulk operations or corrections
   * @param updates - Map of teacherId to classCount
   * @returns Promise<void>
   */
  async batchUpdateClassesHeld(
    updates: Map<string, number>
  ): Promise<void> {
    try {
      const batch = writeBatch(db);
      updates.forEach((count, teacherId) => {
        const userRef = doc(db, 'users', teacherId);
        batch.update(userRef, { classesHeld: count });
      });
      await batch.commit();
    } catch (error) {
      console.error('Error batch updating classes held:', error);
      throw error;
    }
  },

  /**
   * Recalculate classes held based on completed scheduled classes
   * @param teacherId - The teacher's Firebase UID
   * @param completedClassesCount - Number of completed classes from Firestore
   * @returns Promise<void>
   */
  async syncClassesHeld(
    teacherId: string,
    completedClassesCount: number
  ): Promise<void> {
    try {
      const userRef = doc(db, 'users', teacherId);
      await updateDoc(userRef, {
        classesHeld: completedClassesCount,
      });
    } catch (error) {
      console.error('Error syncing classes held:', error);
      throw error;
    }
  },
};
