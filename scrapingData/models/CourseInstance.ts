import { ClassTime } from "./ClassTime";

/**
 * Interface to contain all information about an instance of a course.
 * That is, it contains the department the course belongs to and other information
 * about the course itself. It also contains scheduling information, such as start
 * and end times, location, type, etc.
 */
export interface CourseInstance {

    /**
     * The department of the course. For example, it may be "CSE" for
     * CSE 432 A
     */
    department: string;

    /**
     * The course number for this course. For example, this may be 432
     * for CSE 432 A
     */
    courseNum: number;

    /**
     * The section information for this course. This contains the letters
     * after the course number. For example, for CSE 432 A, this would be
     * "A"
     */
    section: string;

    /**
     * The title of the course. For example, for CSE 432 A, this would be
     * "Machine Learning"
     */
    title: string;

    /**
     * The crn of the course used for registration.
     */
    crn: number;

    /**
     * The campus at which this instance of the course is being offered.
     */
    campus: string;

    /**
     * The amount of credit hours this course takes.
     */
    creditHours: number;

    /**
     * The current number of students enrolled in the course divided by
     * the number of available sears in string form.
     */
    enrollment: string;

    /**
     * Delivery style of the course. Examples include "Face-to-Face",
     * "Hybrid Asynchronous", "Hybrid Synchronous", "Online Asynchronous",
     * and "Online Synchronous".
     */
    delivery: string;

    /**
     * The days of the week at which this instance of the course takes place.
     */
    daysOfWeek: string[];

    /**
     * Contains the times at which this instance of the course takes place.
     */
    classTimes: ClassTime;

    /**
     * The builing in which the course takes place, if it exists.
     */
    buildingName: string;

    /**
     * The room number in which the course takes place, if it exists.
     */
    roomNumber: string;

    /**
     * The start date of the class.
     */
    startDate: string;

    /**
     * The end date of the class.
     */
    endDate: string;

    /**
     * True if the class is a sprint course, false otherwise.
     */
    isSprint: boolean;

    /**
     * true if the course is a web class.
     */
    isWeb: boolean;

    /**
     * If a class has any hardcoded individual dates, this is where they go.
     */
    individualDates?: string[];
}