import { CourseInstance } from "./CourseInstance";

/**
 * Contains all the course instances of a class.
 */
export interface ClassAllInstances {

    /**
     * All of the different combinations of start/end times
     */
    courseInstances: CourseInstance[];
}