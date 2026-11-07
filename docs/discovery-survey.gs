/**
 * Builds the "GymJourno – Tell us how you train" Google Form: a survey people fill in themselves.
 * They pick their role first (individual, independent trainer, creator-trainer, gym owner) and see
 * only that role's questions, multiple choice where possible and free text where it matters.
 *
 * Run createDiscoverySurvey once from https://script.google.com (signed in as the form's owner).
 * The form's links appear in the execution log; answers land in a linked Google Sheet.
 *
 * Questions ask about what people did (last week, the last time, what they pay now), not what they
 * might do, so the answers test the hypotheses in docs/product-strategy.md (H1–H20).
 */
function createDiscoverySurvey() {
  var form = FormApp.create('GymJourno – Tell us how you train');
  form.setDescription(
    'GymJourno is a new app for planning and logging workouts of every kind, on your own or with a ' +
    'trainer or gym. Before we build more, we want to understand how you train today. It takes about ' +
    '5 minutes. Answers are anonymous unless you choose to leave a way to reach you at the end. ' +
    'We never sell data or show ads.'
  );
  form.setProgressBar(true);

  var role = form.addMultipleChoiceItem().setTitle('Which best describes you?').setRequired(true);
  form.addListItem().setTitle('Which city do you live in?')
    .setChoiceValues(['Bengaluru', 'Chennai', 'Delhi NCR', 'Hyderabad', 'Kolkata', 'Mumbai', 'Pune', 'Other city in India', 'Outside India']);

  // ---------- Individuals ----------
  var individuals = form.addPageBreakItem().setTitle('How you exercise')
    .setHelpText('Think about the last few weeks, not an ideal week.');
  form.addCheckboxItem().setTitle('What kinds of exercise did you do in the last 2 weeks?')
    .setChoiceValues(['Gym weights', 'Zumba or dance class', 'Yoga', 'Pilates', 'Running or walking', 'Cycling or spin', 'Home workout', 'Sport', 'None']).showOtherOption(true);
  form.addMultipleChoiceItem().setTitle('How many days did you exercise last week?')
    .setChoiceValues(['0', '1–2', '3–4', '5 or more']);
  form.addMultipleChoiceItem().setTitle('How do you keep a record of your workouts today?')
    .setChoiceValues(['I don\'t', 'Notebook or notes app', 'A fitness app', 'A smartwatch', 'My trainer keeps it']).showOtherOption(true);
  form.addCheckboxItem().setTitle('If you keep a record, what do you write down?')
    .setChoiceValues(['Which days I trained', 'What I did', 'Weights and reps', 'Time or distance', 'How it felt', 'Classes attended']);
  form.addMultipleChoiceItem().setTitle('After your last class or workout, did you record anything?')
    .setChoiceValues(['Yes', 'No']);
  form.addParagraphTextItem().setTitle('If not, what stopped you?');
  form.addCheckboxItem().setTitle('What are you working towards?')
    .setChoiceValues(['Losing weight', 'Getting stronger or building muscle', 'Stamina and fitness', 'Flexibility', 'Staying active', 'A sport or event']).showOtherOption(true);
  form.addMultipleChoiceItem().setTitle('In the last 6 months, did you stop exercising for a week or more?')
    .setChoiceValues(['Yes', 'No']);
  form.addParagraphTextItem().setTitle('If yes, what happened, and what got you back (or didn\'t)?');
  form.addMultipleChoiceItem().setTitle('Have you used a fitness app and then stopped?')
    .setChoiceValues(['Yes', 'No', 'Never used one']);
  form.addParagraphTextItem().setTitle('If you stopped, why?');
  form.addMultipleChoiceItem().setTitle('Do you have a trainer?')
    .setChoiceValues(['Yes, in person', 'Yes, online', 'I used to', 'Never']);
  form.addMultipleChoiceItem().setTitle('In the last year, have you paid for a fitness app, programme or online subscription?')
    .setChoiceValues(['No', 'Yes, under ₹500 a month', 'Yes, ₹500–1,500 a month', 'Yes, over ₹1,500 a month']);
  form.addTextItem().setTitle('If yes, what did you pay for?');
  form.addScaleItem().setTitle('Imagine logging a class in 10 seconds: what it was (e.g. Zumba), how long, and how hard it felt (1–10). How useful would that be to you?')
    .setBounds(1, 5).setLabels('Not useful', 'Very useful');
  form.addParagraphTextItem().setTitle('What\'s the most annoying thing about keeping up with exercise?');

  // ---------- Independent trainers ----------
  var trainers = form.addPageBreakItem().setTitle('How you coach')
    .setHelpText('For personal trainers and coaches. Think about the last month.');
  form.addMultipleChoiceItem().setTitle('How many clients do you coach right now?')
    .setChoiceValues(['1–5', '6–15', '16–30', 'More than 30']);
  form.addCheckboxItem().setTitle('Where do you coach?')
    .setChoiceValues(['In a gym', 'At clients\' homes', 'Online', 'Outdoors']).showOtherOption(true);
  form.addCheckboxItem().setTitle('Where does a client\'s plan live?')
    .setChoiceValues(['WhatsApp or messages', 'Paper or notebook', 'A spreadsheet', 'A coaching app', 'In my head']).showOtherOption(true);
  form.addMultipleChoiceItem().setTitle('How do you usually know whether a client trained?')
    .setChoiceValues(['They tell me', 'I ask them on WhatsApp', 'I see them in person', 'An app shows me', 'I often don\'t know']);
  form.addParagraphTextItem().setTitle('The last time a client missed a planned workout, what did you do?');
  form.addMultipleChoiceItem().setTitle('How long did that follow-up take?')
    .setChoiceValues(['Under 5 minutes', '5–15 minutes', '15–30 minutes', 'More than 30 minutes', 'I didn\'t follow up']);
  form.addMultipleChoiceItem().setTitle('Hours a week you spend on messages, reminders and chasing clients')
    .setChoiceValues(['Under 1', '1–3', '3–5', 'More than 5']);
  form.addMultipleChoiceItem().setTitle('How do you keep track of who has paid?')
    .setChoiceValues(['Memory', 'Notebook', 'Spreadsheet', 'An app', 'The gym does it']).showOtherOption(true);
  form.addMultipleChoiceItem().setTitle('What do you pay for coaching apps or software now, per month?')
    .setChoiceValues(['Nothing', 'Under ₹500', '₹500–1,500', '₹1,500–3,000', 'More than ₹3,000']);
  form.addTextItem().setTitle('If you pay for one, which?');
  form.addMultipleChoiceItem().setTitle('For an app that holds clients\' plans, workouts and fees in one place, which feels like a fair monthly price?')
    .setChoiceValues(['Under ₹500', '₹500–1,000', '₹1,000–2,000', '₹2,000–3,500', 'More than ₹3,500', 'I wouldn\'t pay']);
  form.addMultipleChoiceItem().setTitle('Would you rather pay a flat monthly fee or by number of clients?')
    .setChoiceValues(['Flat fee', 'By number of clients', 'No preference']);
  form.addMultipleChoiceItem().setTitle('If the app were free for your clients, how many would use it?')
    .setChoiceValues(['Most of them', 'Some', 'Few', 'Not sure']);
  form.addParagraphTextItem().setTitle('What would stop your clients from using an app?');
  form.addMultipleChoiceItem().setTitle('Would you try GymJourno with one client in the next two weeks?')
    .setChoiceValues(['Yes', 'Maybe', 'No']);

  // ---------- Creator-trainers ----------
  var creators = form.addPageBreakItem().setTitle('How you coach your followers')
    .setHelpText('For fitness creators who coach some of their Instagram or YouTube followers.');
  form.addMultipleChoiceItem().setTitle('About how many followers do you have?')
    .setChoiceValues(['Under 5,000', '5,000–50,000', '50,000–250,000', 'More than 250,000']);
  form.addMultipleChoiceItem().setTitle('How many followers do you coach for a fee right now?')
    .setChoiceValues(['None yet', '1–10', '11–50', 'More than 50']);
  form.addParagraphTextItem().setTitle('How did your most recent client go from follower to client?');
  form.addCheckboxItem().setTitle('Where does the coaching happen?')
    .setChoiceValues(['Instagram DMs', 'WhatsApp', 'Google Forms or Sheets', 'A coaching app', 'Video calls']).showOtherOption(true);
  form.addParagraphTextItem().setTitle('What breaks as you take on more clients?');
  form.addMultipleChoiceItem().setTitle('Would you put a link in your bio that takes followers straight into coaching with you on an app?')
    .setChoiceValues(['Yes', 'Maybe', 'No']);
  form.addParagraphTextItem().setTitle('What should a follower see first when they tap that link?');
  form.addMultipleChoiceItem().setTitle('What do you charge a client per month?')
    .setChoiceValues(['Under ₹1,000', '₹1,000–3,000', '₹3,000–6,000', 'More than ₹6,000']);
  form.addMultipleChoiceItem().setTitle('What do you spend on coaching tools per month?')
    .setChoiceValues(['Nothing', 'Under ₹500', '₹500–1,500', '₹1,500–3,000', 'More than ₹3,000']);

  // ---------- Gym owners ----------
  var gyms = form.addPageBreakItem().setTitle('How you run your gym')
    .setHelpText('For gym and studio owners or managers.');
  form.addMultipleChoiceItem().setTitle('How many members does your gym have?')
    .setChoiceValues(['Under 100', '100–300', '300–1,000', 'More than 1,000']);
  form.addMultipleChoiceItem().setTitle('How many trainers?')
    .setChoiceValues(['None', '1–3', '4–10', 'More than 10']);
  form.addMultipleChoiceItem().setTitle('How do you find out a member has stopped coming?')
    .setChoiceValues(['They don\'t renew', 'Staff notice', 'Attendance records', 'Software tells us', 'We usually don\'t']).showOtherOption(true);
  form.addParagraphTextItem().setTitle('The last time a member stopped coming, what did you do?');
  form.addMultipleChoiceItem().setTitle('How do you track fees and payments?')
    .setChoiceValues(['Paper register', 'Spreadsheet', 'Gym software', 'Payment app']).showOtherOption(true);
  form.addMultipleChoiceItem().setTitle('What do you pay for gym software per month?')
    .setChoiceValues(['Nothing', 'Under ₹1,000', '₹1,000–3,000', '₹3,000–6,000', 'More than ₹6,000']);
  form.addTextItem().setTitle('If you use gym software, which, and what do you wish it did?');
  form.addMultipleChoiceItem().setTitle('Would your members use a free app to plan and log their workouts?')
    .setChoiceValues(['Most would', 'Some would', 'Few would', 'Not sure']);
  form.addScaleItem().setTitle('Members would own their workout data; your gym would see attendance and activity counts. How comfortable are you with that?')
    .setBounds(1, 5).setLabels('Not comfortable', 'Very comfortable');
  form.addMultipleChoiceItem().setTitle('Would you try GymJourno with one trainer and a few members?')
    .setChoiceValues(['Yes', 'Maybe', 'No']);

  // ---------- Everyone ----------
  var end = form.addPageBreakItem().setTitle('Last thing');
  form.addMultipleChoiceItem().setTitle('Can we contact you to try GymJourno or ask a couple of follow-up questions?')
    .setChoiceValues(['Yes', 'No']);
  form.addTextItem().setTitle('If yes, your email or WhatsApp number')
    .setHelpText('Only used to contact you about this, and deleted when we\'re done.');
  form.addParagraphTextItem().setTitle('Anything else you\'d like us to know?');

  role.setChoices([
    role.createChoice('I exercise (on my own, in classes or at a gym)', individuals),
    role.createChoice('I\'m a personal trainer or coach', trainers),
    role.createChoice('I\'m a fitness creator who coaches some followers', creators),
    role.createChoice('I own or manage a gym or studio', gyms)
  ]);
  // A section break's navigation decides where the section before it goes: each role's section
  // ends at "Last thing".
  trainers.setGoToPage(end);   // after the individuals' section
  creators.setGoToPage(end);   // after the trainers' section
  gyms.setGoToPage(end);       // after the creators' section

  var sheet = SpreadsheetApp.create('GymJourno – Tell us how you train (responses)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  Logger.log('Edit the survey: ' + form.getEditUrl());
  Logger.log('Share this link: ' + form.getPublishedUrl());
  Logger.log('Responses:       ' + sheet.getUrl());
}
