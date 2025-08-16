import { spawn } from 'child_process';
import * as fs from 'fs';
import { CourseInstance } from './models/CourseInstance';
import { HTMLParser } from './models/HTMLParser';

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
    const arr: CourseInstance[] = HTMLParser.parseIndividualHtmlWithClassInfo("intermediary/individual_blocks/" + i + ".html", classTypes[i]);
    for (let j = 0; j < arr.length; j++) {
      allClasses.push(arr[j]);
    }
  }
  const allClassesString: string = JSON.stringify(allClasses);
  fs.writeFileSync('class_objects_Test.json', allClassesString);
}

//main();


// TO DO, adjust the schedule stuff for hybrid and online asynchronous classes.
// also for where the strongs are
parseIndividuallyScrapedFiles();