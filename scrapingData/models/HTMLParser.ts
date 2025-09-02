import { start } from "repl";
import { CourseInstance } from "./CourseInstance";
import * as fs from 'fs';

export class HTMLParser {

    /**
     * For a given department, gets all the CourseInstances associated with it.
     * 
     * @param fileName The file name to be read
     * @param department The department for this class.
     * @returns all the courses associated with this department.
     */
    public static parseIndividualHtmlWithClassInfo(fileName: string, department: string): CourseInstance[] {
        let htmlText: string = "";
        try {
            htmlText = fs.readFileSync(fileName, 'utf-8');
        } catch (error) {
            console.error('Error reading file:', error);
        }
        const splitHTML: string[] = htmlText.split('<tr class="resultrow" role="row">');
        const returned: CourseInstance[] = [];
        for (let i = 1; i < splitHTML.length; i++) {
            returned.push(this.extractCourseInfo(splitHTML[i], department))
        }
        return returned;
    }

    /**
     * Given the raw html table row for this class, parse its information
     * and return it as a CourseInstance object.
     * 
     * @param html The html containing all the information for this class.
     * @param department The department of this class (ex "CSE")
     * @returns Pretty much all the information about this class instance.
     */
    private static extractCourseInfo(html: string, department: string): CourseInstance {
        const splitByItem: string[] = html.split('</td>');
        const courseNum: string | null = this.rawInfoToString(splitByItem[1]);
        const title: string | null = this.rawInfoToString(splitByItem[2]);
        const section: string | null = this.rawInfoToString(splitByItem[3]);
        const CRN: string | null = this.rawInfoToString(splitByItem[4]);
        const campus: string | null = this.rawInfoToString(splitByItem[5]);
        const creditHours: string | null = this.rawInfoToString(splitByItem[6]);
        const enrollmentRaw: string | null = this.rawInfoToString(splitByItem[7]);
        const enrollment: string | null = enrollmentRaw ? enrollmentRaw.split("<")[0] : null;
        const delivery: string | null = this.rawInfoToString(splitByItem[8]);
        const fullScheduleStuff: string | null = this.rawInfoToString(splitByItem[9]);
        const returned: object = {
            department: department,
            courseNum: courseNum ? parseInt(courseNum) : null,
            section: section,
            title: title,
            crn: CRN ? parseInt(CRN) : null,
            campus: campus,
            creditHours: creditHours ? parseInt(creditHours) : null,
            enrollment: enrollment,
            delivery: delivery,
        }
        this.parseSchedulePart(returned, fullScheduleStuff);
        return returned as CourseInstance;
    }

    /**
     * This method is kind of a mess but the general strategy behind it is it determines
     * how the schedule part of the course if formatted with regular expressions, then
     * passes the parameters to different parsers depending on the format of the schedule
     * part.
     * 
     * @param param The object to add the schedule information to.
     * @param fullScheduleStuff The schedule information
     */
    private static parseSchedulePart(param: object, fullScheduleStuff: string | null): void {
        if (!fullScheduleStuff) {
            return;
        }
        // Regex to check if something follows the typical format of a typical face to face of the days of the week, then the times, then building, room, dates
        const typicalFaceToFaceRegex: RegExp = /^(?:M?T?W?R?F?S?)\s([1-9]|1[0-2]):[0-5]\d(?:am|pm)-([1-9]|1[0-2]):[0-5]\d(?:am|pm)\s[A-Za-z]+\s[A-Za-z0-9]+\s(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\s-\s(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])$/;
        if (typicalFaceToFaceRegex.test(fullScheduleStuff)) {
            HTMLParser.parseTypicalFaceToFace(param, fullScheduleStuff);
            return;
        }

        // Regex to check if this is WEB then a date. If it is then it treats it as a online async
        // class that isnt a spring
        const typicalOnlineAsyncRegex: RegExp = /^WEB\s(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\s-\s(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])$/;
        if (typicalOnlineAsyncRegex.test(fullScheduleStuff)) {
            HTMLParser.parseTypicalOnlineAsync(param, fullScheduleStuff);
            return;
        }

        // Checks to see if it follows the general format of a web async sprint course which is:
        // WEB <strong> 09/08 - 12/12 <small aria-label="Sprint Course">(SPRINT COURSE)</small></strong>
        // The date can be different though.
        const sprintOnlineAsyncRegex: RegExp = /^WEB\s<strong>\s(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\s-\s(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\s<small aria-label="Sprint Course">\(\SPRINT COURSE\)<\/small><\/strong>$/;
        if (sprintOnlineAsyncRegex.test(fullScheduleStuff)) {
            HTMLParser.parseSpringOnlineAsync(param, fullScheduleStuff);
            return;
        }
        
        if (this.isTypicalSyncClass(fullScheduleStuff)) {
            HTMLParser.parseTypicalSyncClass(param, fullScheduleStuff);
            //console.log(fullScheduleStuff);
            return;
        }
        // like the typical face to face regex but does not require a room number.
        const noRoomRegex: RegExp = /^(?:M?T?W?R?F?S?)\s(?:[1-9]|1[0-2]):[0-5]\d(?:am|pm)-(?:[1-9]|1[0-2]):[0-5]\d(?:am|pm)\s[A-Za-z]+\s(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\s-\s(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])$/;
        if (noRoomRegex.test(fullScheduleStuff)) {
            HTMLParser.parseNoRoomFaceToFace(param, fullScheduleStuff);
            return;
        }

        // Regex to see if something is just a single date range.
        const dateOnlyRegex: RegExp = /^(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\s-\s(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])$/;
        if (dateOnlyRegex.test(fullScheduleStuff)) {
            HTMLParser.parseDateOnly(param, fullScheduleStuff)
            return;
        }

        // Regex to check if something follows the format weekday, time, building, room, date range, <hr> WEB date.
        // there can be multiple repears of weekday, time, building, room, date range, <hr> before WEB date.
        const typicalHybridAsyncRegex = /^(?:(?:M?T?W?R?F?S?)\s(?:[1-9]|1[0-2]):[0-5]\d(?:am|pm)-(?:[1-9]|1[0-2]):[0-5]\d(?:am|pm)\s[A-Za-z]+\s[A-Za-z0-9]+\s(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\s-\s(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\s<hr>\s)+WEB\s(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\s-\s(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])$/;
        if (typicalHybridAsyncRegex.test(fullScheduleStuff)) {
            const splitSchedule: string[] = fullScheduleStuff.split("<hr>").map((elem) => elem.trim());
            const allInstances: object[] = []
            for (let i = 0; i <splitSchedule.length; i++) {
                const obj: object = HTMLParser.parseTypicalFaceToFace(param, splitSchedule[i], false);
                allInstances.push(obj);
            }
            const webSplit: string[] = splitSchedule[splitSchedule.length - 1].split(" ");
            const startDate: string = webSplit[1];
            const endDate: string = webSplit[3];
            const webInstance: object = {
                startDate: startDate,
                endDate: endDate,
                isWeb: true
            };
            allInstances.push(webInstance);
            param["parsed_schedule"] = allInstances;
            return;
        }

        // Regex for parsing a face to face class that is also a spring.
        const faceToFaceSprintRegex: RegExp = /^([MTWRFS]+) (\d{1,2}:\d{2}(am|pm)-\d{1,2}:\d{2}(am|pm)) ([A-Za-z]+) ([A-Za-z0-9]+) <strong> (\d{2}\/\d{2} - \d{2}\/\d{2}) <small aria-label="Sprint Course">\(SPRINT COURSE\)<\/small><\/strong>$/;
        if (faceToFaceSprintRegex.test(fullScheduleStuff)) {
            HTMLParser.parseSprintFaceToFace(param, fullScheduleStuff);
            return;
        }

        // Regular face to face class but with multiple classes and maybe times im not sure
        const faceToFaceMultipleRooms: RegExp = /^([MTWRFS]+ \d{1,2}:\d{2}(am|pm)-\d{1,2}:\d{2}(am|pm) [A-Za-z0-9]+ [A-Za-z0-9]+ \d{2}\/\d{2} - \d{2}\/\d{2})( <hr> [MTWRFS]+ \d{1,2}:\d{2}(am|pm)-\d{1,2}:\d{2}(am|pm) [A-Za-z0-9]+ [A-Za-z0-9]+ \d{2}\/\d{2} - \d{2}\/\d{2})*$/;
        if (faceToFaceMultipleRooms.test(fullScheduleStuff)) {
            HTMLParser.parseFaceToFaceMultipleRooms(param, fullScheduleStuff);
            return;
        }

        // Starts with the in person class then goes into the web class. Is a sprint course as well and is hybrid async
        const hybridAsyncInPersonFirstSprintRegex: RegExp = /^[MTWRFS]+ \d{1,2}:\d{2}(am|pm)-\d{1,2}:\d{2}(am|pm) [A-Za-z0-9]+ [A-Za-z0-9]+ <strong> \d{2}\/\d{2} - \d{2}\/\d{2} <small aria-label="Sprint Course">\(SPRINT COURSE\)<\/small><\/strong> <hr> WEB <strong> \d{2}\/\d{2} - \d{2}\/\d{2} <small aria-label="Sprint Course">\(SPRINT COURSE\)<\/small><\/strong>$/;
        if (hybridAsyncInPersonFirstSprintRegex.test(fullScheduleStuff)) {
            HTMLParser.parseHybridAsyncLeadInperson(param, fullScheduleStuff)
            return;
        }

        // Starts with web then goes in person. Is a sprint course as well and is hybrid async
        const hybridSyncWebFirstSprintRegex = /^[MTWRFS]+ \d{1,2}:\d{2}(am|pm)-\d{1,2}:\d{2}(am|pm) WEB <strong> \d{2}\/\d{2} - \d{2}\/\d{2} <small aria-label="Sprint Course">\(SPRINT COURSE\)<\/small><\/strong> <hr> [MTWRFS]+ \d{1,2}:\d{2}(am|pm)-\d{1,2}:\d{2}(am|pm) [A-Za-z0-9]+ [A-Za-z0-9]+ <strong> \d{2}\/\d{2} - \d{2}\/\d{2} <small aria-label="Sprint Course">\(SPRINT COURSE\)<\/small><\/strong>$/;
        if (hybridSyncWebFirstSprintRegex.test(fullScheduleStuff)) {
            HTMLParser.parseHybridSyncLeadWeb(param, fullScheduleStuff)
            return;
        }

        // Used for sprint online synchronous courses
        const sprintWebSyncRegex: RegExp = /^[MTWRFS]+ \d{1,2}:\d{2}(am|pm)-\d{1,2}:\d{2}(am|pm) WEB <strong> \d{2}\/\d{2} - \d{2}\/\d{2} <small aria-label="Sprint Course">\(SPRINT COURSE\)<\/small><\/strong>$/;
        if (sprintWebSyncRegex.test(fullScheduleStuff)) {
            HTMLParser.parseSprintWebSync(param, fullScheduleStuff);
            return;
        }

        // Similar to the one for repeated face to face ones but it does not
        // have a room number
        const repeatedWithNoRoomNumRegex: RegExp = /^([MTWRFS]+ \d{1,2}:\d{2}(am|pm)-\d{1,2}:\d{2}(am|pm) [A-Za-z0-9]+ \d{2}\/\d{2} - \d{2}\/\d{2})( <hr> [MTWRFS]+ \d{1,2}:\d{2}(am|pm)-\d{1,2}:\d{2}(am|pm) [A-Za-z0-9]+ \d{2}\/\d{2} - \d{2}\/\d{2})*$/;
        if (repeatedWithNoRoomNumRegex.test(fullScheduleStuff)) {
            HTMLParser.parseRepeatedWithNoRoomNum(param, fullScheduleStuff);
            return;
        }

        // includes single date.
        const mixedDateScheduleRegex = /^([MTWRFS]+ \d{1,2}:\d{2}(am|pm)-\d{1,2}:\d{2}(am|pm) [A-Za-z0-9]+ [A-Za-z0-9]+ (\d{2}\/\d{2} - \d{2}\/\d{2}|\d{2}\/\d{2}))( <hr> [MTWRFS]+ \d{1,2}:\d{2}(am|pm)-\d{1,2}:\d{2}(am|pm) [A-Za-z0-9]+ [A-Za-z0-9]+ (\d{2}\/\d{2} - \d{2}\/\d{2}|\d{2}\/\d{2}))*$/;
        if (mixedDateScheduleRegex.test(fullScheduleStuff)) {
            HTMLParser.parseMixedDateSchedule(param, fullScheduleStuff);
            return;
        }

        // Regex where the location is only specified in one of the parts.
        const locationSpecifiedOnceRegex: RegExp = /^([MTWRFS]+ \d{1,2}:\d{2}(am|pm)-\d{1,2}:\d{2}(am|pm)( [A-Za-z0-9]+ [A-Za-z0-9]+)? (\d{2}\/\d{2} - \d{2}\/\d{2}|\d{2}\/\d{2}))( <hr> [MTWRFS]+ \d{1,2}:\d{2}(am|pm)-\d{1,2}:\d{2}(am|pm)( [A-Za-z0-9]+ [A-Za-z0-9]+)? (\d{2}\/\d{2} - \d{2}\/\d{2}|\d{2}\/\d{2}))*$/;
        if (locationSpecifiedOnceRegex.test(fullScheduleStuff)) {
            return;
        }

        const webFirstHybridAsync: RegExp = /^WEB \d{2}\/\d{2} - \d{2}\/\d{2}(?: <hr> [MTWRFS]+ \d{1,2}:\d{2}(?:am|pm)-\d{1,2}:\d{2}(?:am|pm) \S+ \S+ \d{2}\/\d{2} - \d{2}\/\d{2})+$/;
        if (webFirstHybridAsync.test(fullScheduleStuff)) {
            return;
        }

        
//         console.log(`Delivery type: ${param["delivery"]}
// ${fullScheduleStuff}
// ______________________________________________________________________________________________`);
        // console.log(`${param["department"]} ${param["courseNum"]} ${param["section"]} ${param["campus"]} ${param["delivery"]}`);
        // console.log(fullScheduleStuff);
        // console.log("___________________________________________")
        //console.log("1");
    }

    /**
     * Parses something of the following format:
     * 
     * MW 10:05am-11:25am FSB 0021 08/25 - 12/12 <hr> T 6:00pm-7:20pm FSB 0025 09/23 <hr> T 6:00pm-7:20pm FSB 0025 10/21
     * 
     * Where it can be a date range or just a single date.
     * 
     * @param param Contains the non schedule information about this section
     * @param fullScheduleStuff Contains the schedule information for this section
     * @param addToObject Whether or not to add the parsed schedule to the param
     * @returns The parsed schedule information.
     */
    private static parseMixedDateSchedule(param: object, fullScheduleStuff: string, addToObject: boolean = true): object[] {
        const splitSchedule: string[] = fullScheduleStuff.split("<hr>").map(part => part.trim());
        const returned: object[] = [];
        for (const schedule of splitSchedule) {
            const parsedSchedulePart: object = {};
            const scheduleParts: string[] = schedule.split(" ");
            const daysOfWeek: string[] = HTMLParser.getDaysOfWeek(scheduleParts[0]);
            const startTime: string = scheduleParts[1].split("-")[0];
            const endTime: string = scheduleParts[1].split("-")[1];
            const building: string = scheduleParts[2];
            const room: string = scheduleParts[3];
            if (scheduleParts[6]) {
                const startDate = scheduleParts[4];
                const endDate = scheduleParts[6];
                parsedSchedulePart["startDate"] = startDate;
                parsedSchedulePart["endDate"] = endDate;
            } else {
                const soloDate: string = scheduleParts[4];
                parsedSchedulePart["individualDates"] = soloDate;
            }
            parsedSchedulePart["daysOfWeek"] = daysOfWeek;
            parsedSchedulePart["startTime"] = startTime;
            parsedSchedulePart["endTime"] = endTime;
            parsedSchedulePart["building"] = building;
            parsedSchedulePart["room"] = room;
            returned.push(parsedSchedulePart);
        }
        if (addToObject) {
            param["parsed_schedule"] = returned;
        }
        return returned;
    }

    /**
     * Parses something of the following format:
     * T 3:30pm-5:00pm CHA 08/25 - 12/12 <hr> W 8:45am-10:15am CHA 08/25 - 12/12
     * 
     * basically the individual no room parser but can accept mutliple.
     * 
     * @param param contains the non schedule information about the class
     * @param fullScheduleStuff the schedule information for the class
     * @param addToObject whether or not to add the parsed schedule information to the param
     * @returns the parsed schedule for all times.
     */
    private static parseRepeatedWithNoRoomNum(param: object, fullScheduleStuff: string, addToObject: boolean = true): object[] {
        const individualTimes: string[] = fullScheduleStuff.split("<hr>").map(line => line.trim());
        const returned: object[] = [];
        for (const time of individualTimes) {
            returned.push(HTMLParser.parseNoRoomFaceToFace(param, time, false));
        }
        if (addToObject) {
            param["parsed_schedule"] = fullScheduleStuff;
        }
        return returned;
    }

    /**
     * Parses something of the format:
     * T 5:00pm-7:30pm WEB <strong> 09/08 - 12/12 <small aria-label="Sprint Course">(SPRINT COURSE)</small></strong>
     * into a readable object.
     * 
     * @param param  the object that contains the general class information
     * @param fullScheduleStuff the string containing the general string information
     * @param addToObject whether or not to add the parsed schedule to param
     * @returns the non array wrapped version of the parsed schedule for this section.
     */
    private static parseSprintWebSync(param: object, fullScheduleStuff: string, addToObject: boolean = true): object {
        const scheduleParts: string[] = fullScheduleStuff.split(" ");
        const daysOfWeek: string[] = HTMLParser.getDaysOfWeek(scheduleParts[0]);
        const startTime: string = scheduleParts[1].split("-")[0];
        const endTime: string = scheduleParts[1].split("-")[1];
        const startDate: string = scheduleParts[4];
        const endDate: string = scheduleParts[6];
        const nonArrWrapped: object = {
            daysOfWeek: daysOfWeek,
            startTime: startTime,
            endTime: endTime,
            startDate: startDate,
            endDate: endDate,
            isSprint: true,
            isWeb: true
        };
        if (addToObject) {
            param["parsed_schedule"] = [nonArrWrapped];
        }
        return nonArrWrapped;
    }

    /**
     * Parses schedule information of this format:
     * M 6:00pm-8:05pm WEB <strong> 10/22 - 12/12 <small aria-label="Sprint Course">(SPRINT COURSE)</small></strong> <hr> M 6:00pm-8:05pm CPA 114 <strong> 10/22 - 12/12 <small aria-label="Sprint Course">(SPRINT COURSE)</small></strong>
     * 
     * @param param The object containing all info for this object.
     * @param fullScheduleStuff The above schedule information containing times
     * @param addToObject whether or not to add the parsed schedule to param
     * @returns The parsed schedule in ob
     */
    private static parseHybridSyncLeadWeb(param: object, fullScheduleStuff: string, addToObject: boolean = true): object[] {
        const scheduleHalves: string[] = fullScheduleStuff.split("<hr>").map(part => part.trim());
        const splitFirstHalf: string[] = scheduleHalves[0].split(" ");
        const splitSecondHalf: string[] = scheduleHalves[1].split(" ");
        const daysOfWeekWeb: string[] = HTMLParser.getDaysOfWeek(splitFirstHalf[0]);
        const daysOfWeekFTF: string[] = HTMLParser.getDaysOfWeek(splitSecondHalf[0]);
        const startTimeWeb: string = splitFirstHalf[1].split("-")[0];
        const endTimeWeb: string = splitFirstHalf[1].split("-")[1];
        const startTimeFTF: string = splitSecondHalf[1].split("-")[0];
        const endTimeFTF: string = splitSecondHalf[1].split("-")[1];
        const ftfBuilding: string = splitSecondHalf[2];
        const ftfRoom: string = splitSecondHalf[3];
        const startDate: string = splitSecondHalf[5];
        const endDate: string = splitSecondHalf[7];
        const webObj: object = {
            startDate: startDate,
            endDate: endDate,
            startTime: startTimeWeb,
            endTime: endTimeWeb,
            daysOfWeek: daysOfWeekWeb,
            isSprint: true,
            isWeb: true
        }
        const ftfObj: object = {
            startDate: startDate,
            endDate: endDate,
            startTime: startTimeFTF,
            endTime: endTimeFTF,
            daysOfWeek: daysOfWeekFTF,
            isSprint: true,
            building: ftfBuilding,
            room: ftfRoom
        }
        const objArr: object[] = [ftfObj, webObj];
        if (addToObject) {
            param["parsed_schedule"] = objArr
        }
        return objArr;
    }

    /**
     * Parses the schedule for an object that starts with the inperson and has a web version for an hybrid
     * async sprint class
     * 
     * @param param All the information about the class
     * @param fullScheduleStuff The schedule information for this class
     * @param addToObject Whether or not to add the parsed schedule to the param
     * @returns the parsed schedule
     */
    private static parseHybridAsyncLeadInperson(param: object, fullScheduleStuff: string, addToObject: boolean = true): object[] {
        const scheduleParts: string[] = fullScheduleStuff.split(" ");
        const daysOfWeek: string[] = HTMLParser.getDaysOfWeek(scheduleParts[0]);
        const startTime: string = scheduleParts[1].split("-")[0];
        const endTime: string = scheduleParts[1].split("-")[1];
        const building: string = scheduleParts[2];
        const room: string = scheduleParts[3];
        const startDate: string = scheduleParts[5];
        const endDate: string = scheduleParts[7];
        const scheduleObjs: object[] = [];
        const inPerson: object = {
            daysOfWeek: daysOfWeek,
            startTime: startTime,
            endTime: endTime,
            startDate: startDate,
            endDate: endDate,
            building: building,
            room: room,
            isSprint: true
        }
        scheduleObjs.push(inPerson);
        const web: object = {
            isWeb: true,
            isSprint: true,
            startDate: startDate,
            endDate: endDate
        }
        scheduleObjs.push(web);
        if (addToObject) {
            param["parsed_schedule"] = scheduleObjs;
        }
        return scheduleObjs;
    }


    /**
     * Parses something of the format:
     * MW 2:50pm-3:45pm HUG 315 08/25 - 12/12 <hr> T 12:10pm-2:00pm GAR 052B 08/25 - 12/12
     * 
     * basically just the typical face to face just back to back.
     * 
     * @param param The object containing all the info for this specific class and section
     * @param fullScheduleStuff contains the full schedule information for this class
     * separated by <hr>
     * @param addToObject Whether or not to add the parsed schedule to the param
     * @returns The parsed object.
     */
    private static parseFaceToFaceMultipleRooms(param: object, fullScheduleStuff: string, addToObject: boolean = true): object[] {
        const schedules: object[] = [];
        const splitFullSchedule: string[] = fullScheduleStuff.split("<hr>").map(part => part.trim());
        for (const part of splitFullSchedule) {
            const objToAdd: object = HTMLParser.parseTypicalFaceToFace(param, part, false);
            schedules.push(objToAdd);
        }
        if (addToObject) {
            param["parsed_schedule"] = schedules;
        }
        return schedules;
    }


    /**
     * Parses a typical face to face sprint class of the general format:
     * MW 10:05am-11:25am PBD 121 <strong> 10/08 - 12/12 <small aria-label="Sprint Course">(SPRINT COURSE)</small></strong>
     * 
     * @param param The object to add the schedule to
     * @param fullScheduleStuff The schedule information for this sprint face to face class.
     * @param addToObject optional parameter defaulted to true about whether or not to add the
     * parsed schedule information to the object
     * @returns The parsed schedule information for this class.
     */
    private static parseSprintFaceToFace(param: object, fullScheduleStuff: string, addToObject: boolean = true): object {
        const scheduleParts: string[] = fullScheduleStuff.split(" ");
        const daysOfWeek: string[] = HTMLParser.getDaysOfWeek(scheduleParts[0]);
        const startTime: string = scheduleParts[1].split("-")[0];
        const endTime: string = scheduleParts[1].split("-")[1];
        const building: string = scheduleParts[2];
        const room: string = scheduleParts[3];
        const startDate: string = scheduleParts[5];
        const endDate: string = scheduleParts[7];
        const nonArrWrapped: object = {
            daysOfWeek: daysOfWeek,
            startTime: startTime,
            endTime: endTime,
            building: building,
            room: room,
            startDate: startDate,
            endDate: endDate,
            isSprint: true
        };
        if (addToObject) {
            param["parsed_schedule"] = [nonArrWrapped];
        }
        return nonArrWrapped;
    }

    /**
     * Parses the information for an object that is of the typical format for a 
     * 
     * @param param The object to add the parsed schedule to.
     * @param fullScheduleStuff The full schedule information for this object.
     * @returns The full parsed information for this object not in array form
     */
    private static parseTypicalFaceToFace(param: object, fullScheduleStuff: string, addToObject: boolean = true): object {
        const scheduleParts: string[] = fullScheduleStuff.split(" ");
        const daysOfWeek: string[] = HTMLParser.getDaysOfWeek(scheduleParts[0]);
        const startTime: string = scheduleParts[1].split("-")[0];
        const endTime: string = scheduleParts[1].split("-")[1];
        const building: string = scheduleParts[2];
        const room: string = scheduleParts[3];
        const startDate: string = scheduleParts[4];
        const endDate: string = scheduleParts[6];
        const nonArrWrapped: object = {
            daysOfWeek: daysOfWeek,
            startTime: startTime,
            endTime: endTime,
            building: building,
            room: room,
            startDate: startDate,
            endDate: endDate
        };
        if (addToObject) {
            param["parsed_schedule"] = [nonArrWrapped];
        }
        return nonArrWrapped;
    }

    /**
     * adds the parsed info for a web class with only a date range to param as an array
     * and returns the non arr object.
     * 
     * @param param The object to add schedule information to.
     * @param fullScheduleStuff The full schedule information
     * @returns The unwrapped schedule info.
     */
    private static parseTypicalOnlineAsync(param: object, fullScheduleStuff: string): object {
        const split: string[] = fullScheduleStuff.split(" ");
        const nonArrWrapped: object = {
            isWeb: true,
            startDate: split[1],
            endDate: split[3]
        };
        param["parsed_schedule"] = [nonArrWrapped];
        return nonArrWrapped;
    }

    /**
     * adds the parsed info for a web sprint class with only a date range to param as an array
     * and returns the non arr object.
     * 
     * @param param the object to add info to
     * @param fullScheduleStuff full schedule info for the obj
     * @returns the unwrapped obj of info.
     */
    private static parseSpringOnlineAsync(param: object, fullScheduleStuff: string): object {
        const split: string[] = fullScheduleStuff.split(" ");
        const nonArrWrapped: object = {
            isWeb: true,
            startDate: split[2],
            endDate: split[4],
            isSprint: true
        };
        param["parsed_schedule"] = [nonArrWrapped];
        return nonArrWrapped;
    }

    /**
     * For a class that has all the info for multiple sections of a class this is where it is parsed.
     * 
     * @param param the object to parse information about
     * @param fullScheduleStuff the schedule for that object
     * @returns all the parsed info.
     */
    private static parseTypicalSyncClass(param: object, fullScheduleStuff: string): object[] {
        const courseInstances: string[] = fullScheduleStuff.split("<hr>").map(instance => instance.trim());
        const instances: object[] = [];
        for (let i = 0; i < courseInstances.length; i++) {
            if (courseInstances[i].includes("WEB")) {
                const info: object = HTMLParser.fullInfoWebParser(param, courseInstances[i], false);
                instances.push(info);
                continue;
            }
            const inPersonInfo: object = HTMLParser.parseTypicalFaceToFace(param, courseInstances[i], false)
            instances.push(inPersonInfo);
        }
        param["parsed_schedule"] = instances;
        return instances;
    }

    /**
     * Gets info for schedule section with otherwise full info but contains WEB instead of
     * building and room number.
     * 
     * @param param The object to add info to
     * @param instance the info about this section to be added
     * @param addToObject whether or not to add it directly to the object as array
     * @returns non array form of info
     */
    private static fullInfoWebParser(param: object, instance: string, addToObject: boolean = true): object {
        const scheduleParts: string[] = instance.split(" ");
        const daysOfWeek: string[] = HTMLParser.getDaysOfWeek(scheduleParts[0]);
        const startTime: string = scheduleParts[1].split("-")[0];
        const endTime: string = scheduleParts[1].split("-")[1];
        const startDate: string = scheduleParts[3];
        const endDate: string = scheduleParts[5];
        const nonArrWrapped: object = {
            daysOfWeek: daysOfWeek,
            startTime: startTime,
            endTime: endTime,
            isWeb: true,
            startDate: startDate,
            endDate: endDate
        };
        if (addToObject) {
            param["parsed_schedule"] = [nonArrWrapped];
        }
        return nonArrWrapped;
    }

    /**
     * Parses the schedule information for a schedule that is the same as a typical face to face but does not
     * include a room number
     * 
     * @param param The object to add to
     * @param fullScheduleStuff The full schedule information for this object, this is the same as the typical
     * face to face but does not include a room number
     * @param addToObject boolean to control whether or not to add it to the object in array form.
     * @returns The non arr wrapped object.
     */
    private static parseNoRoomFaceToFace(param: object, fullScheduleStuff: string, addToObject: boolean = true): object {
        const scheduleParts: string[] = fullScheduleStuff.split(" ");
        const daysOfWeek: string[] = HTMLParser.getDaysOfWeek(scheduleParts[0]);
        const startTime: string = scheduleParts[1].split("-")[0];
        const endTime: string = scheduleParts[1].split("-")[1];
        const building: string = scheduleParts[2];
        const startDate: string = scheduleParts[3];
        const endDate: string = scheduleParts[5];
        const nonArrWrapped: object = {
            daysOfWeek: daysOfWeek,
            startTime: startTime,
            endTime: endTime,
            building: building,
            startDate: startDate,
            endDate: endDate
        };
        if (addToObject) {
            param["parsed_schedule"] = [nonArrWrapped];
        }
        return nonArrWrapped;
    }

    /**
     * Parses the date of a fullScheduleInfo that is just a date.
     * 
     * @param param The object to add to
     * @param fullScheduleStuff the schedule information that only includes the date range
     * @param addToObject whether or not to add it do param
     * @returns the non arr wrapped date info.
     */
    private static parseDateOnly(param: object, fullScheduleStuff: string, addToObject: boolean = true): object {
        const scheduleParts: string[] = fullScheduleStuff.split(" ");
        const startDate: string = scheduleParts[0];
        const endDate: string = scheduleParts[2];
        const nonArrWrapped: object = {
            startDate: startDate,
            endDate: endDate
        };
        if (addToObject) {
            param["parsed_schedule"] = [nonArrWrapped];
        }
        return nonArrWrapped;
    }

    // == ----------------------------------- HELPER ---------------------------------------- == //

    /**
     * Gets whether or not a given scheduling information string fits the format
     * of a typical hybrid asynchronous class. This basically means it fits the following
     * format:
     * 
     * The days of the week part comes first, then a time range, then the next block is one
     * of the two following options:
     * 
     * 1. Some amount of letters then some amount of numbers. This represents the building
     * and room number.
     * OR
     * 2. The string WEB to represent that this part of the class is online.
     * 
     * After that, there is a date range. Next is the tricky part. There are optional
     * <hr> tags to represent a separation of the class informations, then the pattern
     * resets from the days of the week. An example of something that returns true:
     * 
     * W 4:25pm-7:05pm MCG 317 08/25 - 12/12 <hr> W 4:25pm-7:05pm WEB 08/25 - 12/12 <hr> F 11:40am-1:00pm MCG 322 08/25 - 12/12
     * 
     * @param input The string to test to see if it fits the typical format
     * of a hybrid synchronous class.
     * @returns Whether or not it fits the typical format of a hybrid synchronous
     * class.
     */
    private static isTypicalSyncClass(input: string): boolean {
        const block = String.raw`(?:M?T?W?R?F?S?)\s(?:[1-9]|1[0-2]):[0-5]\d(?:am|pm)-(?:[1-9]|1[0-2]):[0-5]\d(?:am|pm)\s(?:WEB|[A-Za-z]+\s\d+)\s(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\s-\s(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])`;
        const pattern = new RegExp(`^${block}(?:\\s<hr>\\s${block})*$`);
        return pattern.test(input);
    }

    /**
     * Given the first letter of the days of the week that a class happens
     * in string form, gets the full names.
     * 
     * @param s The string containing the days of the week in the form
     * "MTWRF"
     * @returns The string array form of all of the full days of the week.
     */
    private static getDaysOfWeek(s: string): string[] {
        const returned: string[] = [];
        if (s.includes("M")) {
            returned.push("Monday");
        }
        if (s.includes("T")) {
            returned.push("Tuesday");
        }
        if (s.includes("W")) {
            returned.push("Wednesday");
        }
        if (s.includes("R")) {
            returned.push("Thursday");
        }
        if (s.includes("F")) {
            returned.push("Friday");
        } if (s.includes("S")) {
            returned.push("Other");
        }
        return returned;
    }

    /**
     * Captures the content of a string of the format <td>CONTENT</td> to get
     * the content.
     * 
     * @param rawInfo The html form of the one element of the table row for the class
     * @returns the trimmed and proper whitespace version of the 
     */
    private static rawInfoToString(rawInfo: string): string | null {
        const regex = /<td\b[^>]*>(.*)/g;
        const rawInfoPoint: string = rawInfo.replace(/\s+/g, " ");
        const match = regex.exec(rawInfoPoint)
        if (match) {
            return match[1].trim();
        }
        return null;
    }
}