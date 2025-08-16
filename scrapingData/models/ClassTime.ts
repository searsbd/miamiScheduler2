/**
 * Class to contain and do basic operations on the start and end times
 * of a given class instance.
 */
export class ClassTime {

    /**
     * The start time of the class in minutes since midnight
     */
    private startTime: number;
    
    /**
     * The end time of the class in minutes since midnight
     */
    private endTime: number;

    /**
     * Sets the start time of the class based on the string of the
     * format HH:MMam in minutes since midnight.
     * 
     * @param startTime The string form directly from the html of the
     * start time of the class.
     */
    public setStartTime(startTime: string): void {
        this.startTime = this.scrapedTimeStringToMinutes(startTime);
    }

    /**
     * Sets the end time of the class based on the string of the
     * format HH:MMam in minutes since midnight.
     * 
     * @param startTime The string form directly from the html of the
     * end time of the class.
     */
    public setEndTime(endTime: string): void {
        this.endTime = this.scrapedTimeStringToMinutes(endTime);
    }

    /**
     * Returns the start time of the class in string form.
     * 
     * @returns The start time of the class in string form
     * following the format of HH:MMam
     */
    public getStartTimeString(): string {
        return this.minutesToTimeString(this.startTime);
    }

    /**
     * Gets the start time of the course instance
     * in minutes since midnight.
     * 
     * @returns The start time of the course instance
     * in minutes since midnight
     */
    public getStartTimeNumber(): number {
        return this.startTime;
    }

    /**
     * Returns the end time of the class in string form.
     * 
     * @returns The end time of the class in string form
     * following the format of HH:MMam
     */
    public getEndTimeString(): string {
        return this.minutesToTimeString(this.endTime);
    }

    /**
     * Gets the end time of the course instance
     * in minutes since midnight.
     * 
     * @returns The end time of the course instance
     * in minutes since midnight
     */
    public getEndTimeNumber(): number {
        return this.endTime;
    }

    

    /**
     * For a date of the format scraped from the page,
     * it converts it to a minutes since midnight.
     * 
     * @param time The minutes since midnight for that time.
     */
    private scrapedTimeStringToMinutes(time: string): number {
        try {
            const period = time.slice(-2).toLowerCase();
            const [hourStr, minuteStr] = time.slice(0, -2).split(":");
            let hours = parseInt(hourStr, 10);
            const minutes = parseInt(minuteStr, 10);
            if (period === "am") {
                if (hours === 12) hours = 0;
            } else if (period === "pm") {
                if (hours !== 12) hours += 12;
            }
            return hours * 60 + minutes;
        } catch (error) {
            console.log("error in parsing date part");
            return -999999;
        }
    }

    /**
     * Converts a number that represents the time since midnight in minutes
     * to am pm form string.
     * 
     * @param minutesSinceMidnight The minutes since midnight
     * @returns The time in am/pm string form.
     */
    private minutesToTimeString(minutesSinceMidnight: number): string {
        const hours24 = Math.floor(minutesSinceMidnight / 60);
        const minutes = minutesSinceMidnight % 60;
        const hours12 = hours24 % 12 || 12;
        const ampm = hours24 < 12 ? "AM" : "PM";
        const hourStr = String(hours12).padStart(2, "0");
        const minuteStr = String(minutes).padStart(2, "0");
        return `${hourStr}:${minuteStr} ${ampm}`;
    }
}