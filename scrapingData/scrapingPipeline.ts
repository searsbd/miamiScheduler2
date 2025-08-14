import { spawn } from 'child_process';
import * as fs from 'fs';
import { CourseInstance } from './interfaces/Section';

/**
 * The full pipeline that gets the columns to be scraped, scrapes them,
 * then parses them.
 */
async function main(): Promise<void> {
  await getInitialScrape();
  parseClassTypes();
  await getIndividualScrapes();
  parseIndividuallyScrapedFiles();
}

/**
 * Gets and saves the html for the 100+ individual department
 * class lists.
 */
async function getIndividualScrapes(): Promise<void> {
  const pythonScriptPath = './all_courses_scrape.py';
  const mainScraper = spawn('python', [pythonScriptPath]);
  await new Promise<void>((resolve, reject) => {
    mainScraper.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Python process exited with code ${code}`));
      }
    });
  });
}

/**
 * Gets the initial scrape of the course list so we know which departments
 * to query.
 */
async function getInitialScrape(): Promise<void> {
  const pythonScriptPath = './initial_scrape.py';
  const initialColumnGetter = spawn('python', [pythonScriptPath]);
  await new Promise<void>((resolve, reject) => {
    initialColumnGetter.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Python process exited with code ${code}`));
      }
    });
  });
}

/**
 * Takes the first scraped html file ("course_headers.html") and scrapes all of the departments
 * that classes are associated with.
 */
function parseClassTypes(): void {
  let firstHTML: string = "";
  try {
    firstHTML = fs.readFileSync('intermediary/course_headers.html', 'utf-8');
  } catch (error) {
    console.error('Error reading file:', error);
  }
  const startIndex: number = firstHTML.indexOf('<select id="subject" class="form-control" name="subject[]" multiple="multiple">');
  const isolatedOptions: string = firstHTML.substring(startIndex).split("</select>")[0];
  const optionArr: string[] = isolatedOptions.split("<option");
  const allValues: string[] = [];
  for (const option of optionArr) {
    const match = option.match(/value="([^"]*)"/);
    if (match) {
      allValues.push(match[1]);
    }
  }
  const valueStringForm: string = JSON.stringify(allValues);
  fs.writeFileSync('intermediary/class_codes.json', valueStringForm);
}

/**
 * Parses all of the 100+ ish individually scraped files that contain
 * the information about the courses and writes them to a file called
 * "class_objects.json".
 */
function parseIndividuallyScrapedFiles(): void {
  let classTypesString: string = "";
  try {
    classTypesString = fs.readFileSync('intermediary/class_codes.json', 'utf-8');
  } catch (error) {
    console.error('Error reading file:', error);
  }
  const allClasses: CourseInstance[] = []
  const classTypes: string[] = JSON.parse(classTypesString);
  for (let i = 0; i < classTypes.length; i++) {
    const arr: CourseInstance[] = parseIndividualHtmlWithClassInfo("intermediary/individual_blocks/" + i + ".html", classTypes[i]);
    for (let j = 0; j < arr.length; j++) {
      allClasses.push(arr[j]);
    }
  }
  const allClassesString: string = JSON.stringify(allClasses);
  fs.writeFileSync('class_objects.json', allClassesString);
}

/**
 * For a given department, gets all the CourseInstances associated with it.
 * 
 * @param fileName The file name to be read
 * @param department The department for this class.
 * @returns all the courses associated with this department.
 */
function parseIndividualHtmlWithClassInfo(fileName: string, department: string): CourseInstance[] {
  let htmlText: string = "";
  try {
    htmlText = fs.readFileSync(fileName, 'utf-8');
  } catch (error) {
    console.error('Error reading file:', error);
  }
  const splitHTML: string[] = htmlText.split('<tr class="resultrow" role="row">');
  const returned: CourseInstance[] = [];
  for (let i = 1; i < splitHTML.length; i++) {
    returned.push(extractCourseInfo(splitHTML[i], department))
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
function extractCourseInfo(html: string, department: string): CourseInstance {
  const splitByItem: string[] = html.split('</td>');
  const courseNum: string | null = rawInfoToString(splitByItem[1]);
  const title: string | null = rawInfoToString(splitByItem[2]);
  const section: string | null = rawInfoToString(splitByItem[3]);
  const CRN: string | null = rawInfoToString(splitByItem[4]);
  const campus: string | null = rawInfoToString(splitByItem[5]);
  const creditHours: string | null = rawInfoToString(splitByItem[6]);
  const enrollmentRaw: string | null = rawInfoToString(splitByItem[7]);
  const enrollment: string | null = enrollmentRaw ? enrollmentRaw.split("<")[0] : null;
  const delivery: string | null = rawInfoToString(splitByItem[8]);
  const fullScheduleStuff: string | null = rawInfoToString(splitByItem[9]);
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
  parseSchedulePart(returned, fullScheduleStuff);
  return returned as CourseInstance;
}

/**
 * TODO: FIX FOR THE ONLINE AND HYBRID VERSIONS.
 * Takes the schedule information for a given object and
 * adds it to the object.
 * 
 * @param param The object to add the schedule information to.
 * @param fullScheduleStuff The schedule information
 */
function parseSchedulePart(param:object, fullScheduleStuff: string | null): void {
  const splitSchedule: string[] = (fullScheduleStuff ?? "").split(" ");
  const daysOfWeek: string[] = getDaysOfWeek(splitSchedule[0]);
  const startAndEndTimes: string[] = (splitSchedule[1] ?? "").split("-");
  const startTime: number | null = timeToMinutesSinceMidnight(startAndEndTimes[0]);
  const endTime: number | null = timeToMinutesSinceMidnight(startAndEndTimes[1]);
  const building: string = splitSchedule[2];
  const roomNum: number = parseInt(splitSchedule[3]);
  const startDate: string = splitSchedule[4];
  const endDate: string = splitSchedule[6];
  param["daysOfWeek"] = daysOfWeek;
  param["startTime"] = startTime;
  param["endTime"] = endTime;
  param["buildingName"] = building;
  param["roomNumber"] = roomNum;
  param["startDate"] = startDate;
  param["endDate"] = endDate;
}

/**
 * For a given date gets the time since midnight in minutes.
 * 
 * @param timeStr For a a date of the form "11:00pm" gets the time
 * since midnight in minutes
 * @returns the time since midnight in minutes.
 */
function timeToMinutesSinceMidnight(timeStr: string): number | null {
    try {
      const period = timeStr.slice(-2).toLowerCase();
      const [hourStr, minuteStr] = timeStr.slice(0, -2).split(":");
      let hours = parseInt(hourStr, 10);
      const minutes = parseInt(minuteStr, 10);
      if (period === "am") {
          if (hours === 12) hours = 0;
      } else if (period === "pm") {
          if (hours !== 12) hours += 12;
      }
      return hours * 60 + minutes;
    } catch (error) {
      console.log(error);
      return null;
    }
}

/**
 * Given the first letter of the days of the week that a class happens
 * in string form, gets the full names.
 * 
 * @param s The string containing the days of the week in the form
 * "MTWRF"
 * @returns The string array form of all of the full days of the week.
 */
function getDaysOfWeek(s: string): string[] {
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
  }
  return returned;
}

/**
 * 
 * @param rawInfo The html form of the one element of the table row for the class
 * @returns the trimmed and proper whitespace version of the 
 */
function rawInfoToString(rawInfo: string): string | null {
  const regex = /<td\b[^>]*>(.*)/g;
  const rawInfoPoint: string = rawInfo.replace(/\s+/g, " ");
  const match = regex.exec(rawInfoPoint)
    if (match) {
      return match[1].trim();
    }
  return null;
}

//main();


// TO DO, adjust the schedule stuff for hybrid and online asynchronous classes.
parseIndividuallyScrapedFiles();