/**
 * Elementary register (grades 3-5) for the same sixteen work-mode archetypes.
 *
 * The secondary-register text in lessonPhases.mjs averages ~25 words per
 * sentence, which is a reasonable load for grade 7 and up and far too heavy
 * for a third grader — the task a student cannot read is a task they cannot
 * do. These variants keep the phase archetype and the evidence demanded
 * exactly the same, and change only sentence length and vocabulary: short
 * sentences, concrete nouns, one instruction at a time.
 *
 * The grade bands share one rubric, because the work being scored is the
 * same; what differs is how the instruction is worded.
 */

const f = (c) => c.focus
const tp = (c) => c.unitTopics[0] ?? c.focus
const ut = (c) => c.unitTitle
const tp2 = (c) => c.unitTopics[1] ?? c.unitTopics[0] ?? c.focus

export const ELEM_TECH_TASK = {
  PROBE: (c) => `First, write what you already think about ${f(c)}. Do this before anyone explains it. Draw or list the steps you think are needed. Then guess one thing that would break your steps. Try your steps on two examples you make up. Mark what worked. Mark what did not. A wrong guess is fine here. It does not lower your score.`,
  MODEL: (c) => `Use the whole example printed in activity_setup about ${f(c)}. Follow it one step at a time. Do not skip ahead. After each step, write what changed. Make a small table. Show what things looked like before and after each step. Now change one thing in the example. Guess what will happen. Then check. Was your guess right? Last, say the rule for ${f(c)} in your own words.`,
  MODEL_A: (c) => `Look at the first complete case printed in activity_setup for ${f(c)}. Find the rule it follows. Write that rule in one short sentence. Do not put an example inside the sentence. Now make up your own example that follows the rule. Then make one that breaks the rule. Try both. Show which one the rule accepts.`,
  MODEL_B: (c) => `Look at the two complete cases printed in activity_setup for ${f(c)}. Put them next to each other. Make two lists. List what is the same. List what is different. Then say when you would use each one. Take one input the first case handled. Run it through the second one. Write what happened and why.`,
  GUIDED: (c) => `Do two problems about ${f(c)}. For the first one, you may look at the help. After each step, write why that step is right. For the second one, try it on your own first. Check the help only after you answer. Show your work for both. Then say which step felt hardest.`,
  GUIDED_A: (c) => `Do two problems about ${f(c)} with the help sheet next to you. After each step, write why that step works. Show all your steps, not just the answer. Then circle the one step you think you would miss without the help sheet. You will test that step next time.`,
  GUIDED_B: (c) => `Do two new problems about ${f(c)}. This time put the help sheet away. Then compare your work to the problems you did with help. Find any place they are different. Decide which one is right and say why. Look again at the step you circled last time. Did it work today?`,
  APPLY: (c) => `Work on this by yourself for a new problem: ${f(c)}. First write what you put in and what you expect to get out. Then build it. Try it on two examples you pick. Make one easy and one tricky. Write what you expected and what really happened. If they are different, fix it and say what you learned.`,
  BUILD: (c) => `Build something that solves a real need in your unit "${ut(c)}". Build it around what today covers: ${f(c)}. First write what it must do. Write it so you can check it later. Then build it. Test it three ways: a normal case, a tricky case, and one you think will break it. Write down what happened each time. Fix anything that failed. Test again. Turn in the thing you built, your test notes, and one idea you tried but did not use.`,
  INVESTIGATE: (c) => `Look at something about ${f(c)} that someone else made. First figure out what it does. Try it on two inputs. Write down what came out. Then say in plain words how it works. Now say one thing it does well and one thing it does badly. Point to a real step for each. Suggest one change and say why it helps. Only use what your teacher gives you. Never poke at a real website or a real system.`,
  RETEACH: (c) => `Try ${f(c)} again a different way. If you used code before, draw it this time. If you drew it before, build it this time. Do three short problems. Spread them out. Do not do them all at once. After each one, write what this new way helped you see. This work is not for a grade. It is to make ${f(c)} stick.`,
  INCREMENT: (c) => `Add one piece to your unit project. Work on what today covers: ${f(c)}. First write where your project is now. Then write what "done for today" means. Build just that one piece. Check it against what you wrote. Add to your project log: the date, what you changed, what you tested, what broke. Last, name the next piece and what might make it hard.`,
  DEMONSTRATE: (c) => `Show that you can do this on your own: ${f(c)}. Put away the help sheet and the examples. Solve a new problem all the way. First write what answer you expect. Then test it two ways. Include one tricky case. Show what you expected and what you got. Then explain your thinking. Write it so someone new to ${f(c)} could follow it.`,
  SYNTHESIZE: (c) => `Connect ${f(c)} to the other big ideas in this unit, like ${tp2(c)}. Make a one-page map. Show how at least three ideas link up. Label each link. Say how the ideas connect, do not just draw a line. Then solve one problem that needs two of those ideas. Show which part came from which idea. Last, name the idea you are least sure about.`,
  ASSESS: (c) => `Do the unit test task for ${f(c)} on your own. Make what the task asks for. Show your thinking, not just the answer. Check your work before you turn it in. Write what you expected. Write what you got on two tries. Say what you did about any difference. This must be your own work. An adult may explain the directions but must not do the work for you.`,
  CORRECT: (c) => `Look back at your earlier work on ${f(c)} and fix it. Make a fix-it list. For each mistake write four things: what went wrong, why it went wrong, what you changed, and how you know it works now. Include one thing that failed before and works now. Then look at all your mistakes together. What do they have in common? Name one habit that would catch it sooner.`,
}

export const ELEM_ARTS_TASK = {
  PROBE: (c) => `Before anyone teaches you about ${f(c)}, make something small. Take a few minutes. Draw a quick sketch, tap a short pattern, or write what you would make. Any of these is fine. Then write three things you already notice about ${f(c)}. Write one question you cannot answer yet. Keep this. You will look at it again later. This is not judged on how good it is.`,
  MODEL_A: (c) => `Look closely at the first artwork about ${f(c)} before you make anything. Look three times. First, what do you see or hear? Second, how was it put together? Third, how does it make you feel? Name the one choice the artist made to create ${f(c)}. Now copy just that one part in a small study. Not the whole thing. Write one sentence about what was harder than it looked. Say where the artwork came from.`,
  MODEL_B: (c) => `Look at a second artwork about ${f(c)}. Put it next to the first one. Name one choice both artists made the same. Name one place they are clearly different. Say what each difference does to the viewer or listener. Then make a small study using the second artist's way. Name both artworks. Anything you did not make must be free to use or properly credited.`,
  MODEL: (c) => `Watch how the artwork about ${f(c)} was made, step by step. Do not judge the finished piece yet. Write the order the artist worked in. Write the choice made at each stage. Find the spot where it could have gone another way. Now try the stage you found hardest. Make your own small study of it. Write what was different in your hands. Say where the artwork came from.`,
  GUIDED_A: (c) => `Make two small studies about ${f(c)}. You may look at the example while you work. After each one, write the choice you made. Write what you wanted it to do. Keep both studies even if you do not like them. They show your process. Then circle the one move you could not do without the example. You will test that next time. This work stays private unless you want to share it.`,
  GUIDED_B: (c) => `Make two new studies about ${f(c)}. This time put the example away. Then put them next to your first two studies. Where are they different? Decide which one works better and say why. Point to the real work, not just what you like. Look again at the move you circled. Did it work this time? Be honest. You do not have to record, film, or perform anything.`,
  GUIDED: (c) => `Make two small studies about ${f(c)}. Use the example for the first one. Put it away for the second one. After each, write the choice you made and what you wanted it to do. Then look or listen again. Did it work? Say which step made you least sure. Both studies stay private unless you choose to share. Writing about your work is always allowed instead of showing it.`,
  APPLY: (c) => `Make one short original piece using ${f(c)}. First write what you want it to do. Just one sentence. Write it before you start. Then make it. Now step back and look. Did it work? Point to the one part that makes it work. Point to one part that gets in the way. Fix that second part. Keep both versions. The work must be yours. A grown-up may show you how but must not make it for you.`,
  BUILD: (c) => `Make a finished short piece about ${f(c)} for your unit "${ut(c)}". First write what you want it to do. Write how you will know it worked. Then make it. Now check it against what you wrote. Which choice makes it work? Which choice gets in the way? What would you change? Change one thing and keep both versions. Show it only to yourself, a parent, or one trusted grown-up. Or just write about it. You never have to perform, film, or photograph it.`,
  INVESTIGATE: (c) => `Look closely at an artwork about ${f(c)} that you did not make. Describe it first. Do not judge it yet. What is there? How is it put together? What happens as you look or listen? Now say what it makes you feel and which exact part does that. Point to something a reader could check. Last, write one question the artwork makes you wonder. Use only artworks that are free to use or properly credited.`,
  RETEACH: (c) => `Try ${f(c)} again in a different way. If you drew it before, write it this time. If you listened before, put it on paper this time. Make three short studies. Spread them out over the session. After each, write what this new way helped you see. This is not for a grade. It checks that you understand ${f(c)} in more than one way. Keep it private.`,
  INCREMENT: (c) => `Add one piece to your unit project. Work on what today covers: ${f(c)}. First write where your project is now. Write what finishing today's piece looks like. Make just that piece. Check it against what you wrote. Add to your project log: the date, what you changed, what you tried that did not work, what you kept. Name the next piece and the part you are worried about. You do not need an audience, a photo, or a recording.`,
  DEMONSTRATE: (c) => `Show that you can do this on your own: ${f(c)}. Put the examples away. Make one short finished piece or one analysis. Then explain it. What did you want it to do? Which choices made that happen? How did you check? Write it clearly enough that someone who has not seen your work would understand. Writing is fully fine instead of talking or performing. The work must be all your own.`,
  SYNTHESIZE: (c) => `Put ${f(c)} together with the other big ideas in this unit, like ${tp2(c)}. Make one page. It can be a portfolio page, a chart, or a map of your own studies. Show how at least three ideas connect. Show where each one appears in work you really made. Then make or study one short example that needs two ideas at once. Label which is which. Name the idea you are least sure about.`,
  ASSESS: (c) => `Do the unit task for ${f(c)} on your own. Make what the task asks for. Show your process, not just the finished piece. Check it against the criteria before you hand it in. Then judge it yourself. What did you want? What did it really do? Where is the gap? Everything must be your own work. You never have to perform in public, use a camera, record your voice, or take a photo to pass.`,
  CORRECT: (c) => `Go back to your earlier work on ${f(c)} and improve it. Do not just replace it. Make a fix-it list. What was not working? Why do you think that happened? What did you change? How can you tell it is better? Keep the old and new side by side. Then look at all the problems together. What do they have in common? Name one thing you will do differently. Honest notes about weak work score full marks here.`,
}

export const ELEM_TECH_CHECKS = {
  PROBE: (c) => [
    `You wrote what you thought about ${f(c)} before anyone explained it, and you put the date on it.`,
    'You tried your own steps on two examples you made up, and wrote what happened each time.',
    'You marked what worked and what did not, instead of quietly fixing it.',
    'You used made-up names and numbers only. No real password and no real website.',
  ],
  MODEL: (c) => [
    'Your table has one row for each step and shows things before and after.',
    'Each step has a short reason why it is right.',
    'You changed one thing, guessed what would happen, and then checked.',
    `You said the rule for ${f(c)} in your own words.`,
  ],
  MODEL_A: (c) => [
    `Your rule for ${f(c)} is one short sentence with no example in it.`,
    'You made one example that follows the rule and one that breaks it.',
    'You tried both and showed which one the rule accepts.',
    'No real password, real name, or real website appears in your work.',
  ],
  MODEL_B: (c) => [
    'You listed one thing that is the same and one thing that is different.',
    'You said when you would use each one.',
    'You ran one input through both and wrote what happened.',
    'You pointed to real steps, not just how you felt about it.',
  ],
  GUIDED: (c) => [
    'You showed your steps for both problems, not just the answers.',
    'The first problem has a reason for each step. You tried the second one before checking.',
    'You named the step that felt hardest.',
    `Your answers connect to ${f(c)} or another idea from this unit.`,
  ],
  GUIDED_A: (c) => [
    'You did two problems with the help sheet and wrote a reason for each step.',
    'You showed all your steps for both.',
    'You circled exactly one step you would miss without help.',
    'You used only made-up names and numbers.',
  ],
  GUIDED_B: (c) => [
    'You did two new problems without the help sheet.',
    'You compared them to your earlier work and found the differences.',
    'You decided which version is right and said why.',
    'You checked the step you circled last time and said if it worked.',
  ],
  APPLY: (c) => [
    'You wrote what you expected before you built anything.',
    'It works on two examples you picked, and one of them is tricky.',
    'You wrote what you expected and what really happened for both.',
    'Everything is made up. No real password, no real address, no real person.',
  ],
  BUILD: (c) => [
    'You wrote what it must do before you started building.',
    'Your test notes show three tries: normal, tricky, and one meant to break it.',
    'You fixed what failed and tested it again.',
    'You named one idea you tried but did not use, and said why.',
    'Nothing uses a real password, a real account, or a real website.',
  ],
  INVESTIGATE: (c) => [
    'You tried it on two inputs and wrote down what came out.',
    'You explained how it works in plain words before saying if it is good.',
    'You named one good thing and one bad thing and pointed to a real step for each.',
    'Your suggested change is clear and you said why it helps.',
    'You only used what your teacher gave you. You never poked at a real website or system.',
  ],
  RETEACH: (c) => [
    'You used a different way than last time.',
    'You did three problems and spread them out.',
    'After each one you wrote what the new way helped you see.',
    `Your thinking about ${f(c)} matches in both ways.`,
  ],
  INCREMENT: (c) => [
    'You wrote where your project was and what "done for today" meant before starting.',
    'You built one piece and checked it against what you wrote.',
    'Your log has the date, what changed, what you tested, and what broke.',
    'You named the next piece and what might make it hard.',
  ],
  DEMONSTRATE: (c) => [
    'You solved it with no help sheet and no examples in front of you.',
    'You wrote what you expected first, then tested two ways including a tricky one.',
    'Someone new to this could follow your explanation.',
    'This is your own work. Nobody did a graded part for you.',
    'No real password, real person, or real website appears anywhere.',
  ],
  SYNTHESIZE: (c) => [
    'Your map connects at least three ideas and each link is labelled.',
    'Your problem really needs two of those ideas.',
    'You showed which part came from which idea.',
    'You named the idea you are least sure about.',
  ],
  ASSESS: (c) => [
    'You finished what the task asked for, by yourself.',
    'You showed your thinking, not just the answer.',
    'You wrote what you expected and what you got on two tries.',
    'This is all your own work. An adult only explained the directions.',
    'No real accounts, passwords, or websites were used.',
  ],
  CORRECT: (c) => [
    'Your fix-it list says what went wrong, why, what you changed, and how you know it works.',
    'At least one thing failed before and works now.',
    'You said what your mistakes have in common.',
    'You named one habit that would catch it sooner.',
  ],
}

export const ELEM_ARTS_CHECKS = {
  PROBE: (c) => [
    `You made or described something about ${f(c)} before anyone taught it, and put the date on it.`,
    'You wrote three things you noticed and one question you cannot answer yet.',
    'You kept it so you can look at it again later.',
    'Writing about it counted the same as making it. No camera, recording, or audience was needed.',
  ],
  MODEL_A: (c) => [
    'You looked three times: what you see, how it is built, how it feels.',
    `You named the one choice the artist made to create ${f(c)}.`,
    'You copied just one part, not the whole thing, and said what was harder than it looked.',
    'You said where the artwork came from, and it is free to use or properly credited.',
  ],
  MODEL_B: (c) => [
    'You named one thing both artists did the same and one clear difference.',
    'You said what each difference does to a viewer or listener.',
    "You made a small study using the second artist's way.",
    'You named both artworks and credited anything you did not make.',
  ],
  MODEL: (c) => [
    'You wrote the order the artist worked in and the choice at each stage.',
    'You found one place it could have gone another way.',
    'You tried the hardest stage yourself and compared it to the original.',
    'You said where the artwork came from.',
  ],
  GUIDED_A: (c) => [
    'You made two studies with the example nearby and kept both.',
    'Each one says the choice you made and what you wanted it to do.',
    'You circled one move you could not do without the example.',
    'Your work stayed private, seen only by you and maybe one trusted grown-up.',
  ],
  GUIDED_B: (c) => [
    'You made two new studies without the example.',
    'You compared them to the first ones and said which works better and why.',
    'You checked the move you circled and said honestly if it worked.',
    'No recording, photo, performance, or audience was needed.',
  ],
  GUIDED: (c) => [
    'You made two studies and put the example away for the second one.',
    'Each says your choice, what you wanted, and whether it worked when you looked again.',
    'You said which step made you least sure.',
    'Writing about your work was allowed instead of showing it.',
  ],
  APPLY: (c) => [
    'You wrote what you wanted it to do before you started.',
    `Your piece is your own and uses ${f(c)}.`,
    'You pointed to one part that makes it work and one part that gets in the way.',
    'You fixed the weaker part and kept both versions.',
    'You made it yourself. A grown-up may have shown you how but did not make it.',
  ],
  BUILD: (c) => [
    'You wrote what it should do and how you would know, before starting.',
    'Your piece is finished and does what you set out to do.',
    'You named the choice that makes it work and the one that gets in the way.',
    'You changed one thing and kept both versions.',
    'You showed it privately or just wrote about it. No performing, filming, or photos were needed.',
  ],
  INVESTIGATE: (c) => [
    'You described it before judging it.',
    'Everything you said points to something a reader could check in the artwork.',
    'You named the exact part that creates the feeling.',
    'You wrote one question the artwork made you wonder.',
    'The artwork is free to use or properly credited, and you used only a small part.',
  ],
  RETEACH: (c) => [
    'You used a different way than last time.',
    'You made three short studies and spread them out.',
    'After each one you wrote what the new way helped you see.',
    `Your understanding of ${f(c)} matches in both ways. Your work stayed private.`,
  ],
  INCREMENT: (c) => [
    'You wrote where your project was and what today\'s piece would look like.',
    'You finished one piece and checked it against what you wrote.',
    'Your log has the date, what changed, what did not work, and what you kept.',
    'You named the next piece and the part you are worried about.',
    'No audience, photo, or recording was needed as proof.',
  ],
  DEMONSTRATE: (c) => [
    'You worked with the examples put away.',
    'You explained what you wanted, which choices did it, and how you checked.',
    'Someone who has not seen your work could understand your explanation.',
    'Writing counted fully instead of talking or performing.',
    'The work is all your own.',
  ],
  SYNTHESIZE: (c) => [
    'Your page connects at least three ideas and shows where each appears in work you made.',
    'Your example really needs two ideas at once, and you labelled which is which.',
    'You named the idea you are least sure about.',
    'Everything is your own work or properly credited.',
  ],
  ASSESS: (c) => [
    'You finished what the task asked for, on your own.',
    'You showed your process, not just the finished piece.',
    'You said what you wanted, what it really did, and where the gap is.',
    'Everything is your own work.',
    'No public performance, camera, voice recording, or photo was needed to pass.',
  ],
  CORRECT: (c) => [
    'Your fix-it list says what was wrong, why, what you changed, and how you can tell it is better.',
    'You kept the old and new versions side by side.',
    'You said what the problems have in common.',
    'You named one thing you will do differently.',
    'Honest notes about weak work scored full marks.',
  ],
}

export const ELEM_TECH_DELIVERABLE = {
  PROBE: 'Your dated guess sheet, your first sketch or steps, and a two-example try showing what worked and what did not.',
  MODEL: 'Your finished step table with reasons, plus the one change you made with your guess and what really happened.',
  MODEL_A: 'Your one-sentence rule, one example that follows it, one that breaks it, and your tries of both.',
  MODEL_B: 'Your same-and-different lists, when to use each one, and one input run through both.',
  GUIDED: 'Two solved problems with all steps shown, reasons on the first, and the step that felt hardest.',
  GUIDED_A: 'Two solved problems with reasons and all steps, plus the one step you circled.',
  GUIDED_B: 'Two new solved problems, your comparison to last time, and whether the circled step worked.',
  APPLY: 'The thing you built, what you expected written down, and a two-example try log with one tricky case.',
  BUILD: 'The thing you built, what it must do written first, your three-way test notes, and one idea you did not use.',
  INVESTIGATE: 'Your two-input try notes, a plain-words explanation, one good and one bad thing with real steps, and one suggested change.',
  RETEACH: 'Three spread-out problems done a new way, each with a note on what that way helped you see.',
  INCREMENT: 'One finished piece, your updated project log, and the next piece with what might make it hard.',
  DEMONSTRATE: 'Your solution done alone, a two-way check with expected and actual, and an explanation someone new could follow.',
  SYNTHESIZE: 'A one-page labelled map of at least three ideas, plus one problem needing two ideas with each part shown.',
  ASSESS: 'Your finished task, your thinking shown, and a two-try self-check with what you did about any difference.',
  CORRECT: 'Your fix-it list with what went wrong, why, the change, and the check that passes, plus what your mistakes share.',
}

export const ELEM_ARTS_DELIVERABLE = {
  PROBE: 'Your dated first try (made or written), three things you noticed, and one question, all kept for later.',
  MODEL_A: 'Your three-times looking notes, the artist choice you named, one small study, and where the artwork came from.',
  MODEL_B: 'Your same-and-different notes, one small study in the second artist\'s way, and both artwork names.',
  MODEL: 'Your notes on the artist\'s order and choices, one stage you tried yourself, and where the artwork came from.',
  GUIDED_A: 'Two studies with your choices and goals written down, plus the one move you circled.',
  GUIDED_B: 'Two new studies, your comparison to the first ones, and whether the circled move worked.',
  GUIDED: 'Two studies (second one without the example) with your choices, goals, and the step that made you least sure.',
  APPLY: 'One original short piece, what you wanted written first, what works and what gets in the way, and both versions.',
  BUILD: 'A finished short piece, your goal and check written first, what helps and what hurts, and both versions.',
  INVESTIGATE: 'Your describe-first notes with everything pointing to the real artwork, one question, and where it came from.',
  RETEACH: 'Three spread-out studies done a new way, each with a note on what it helped you see.',
  INCREMENT: 'One finished piece, your updated project log, and the next piece with the part you are worried about.',
  DEMONSTRATE: 'One short finished piece or analysis done alone, plus a clear written explanation of what you wanted and how you checked.',
  SYNTHESIZE: 'One page linking at least three ideas to work you really made, plus a two-idea example with each part labelled.',
  ASSESS: 'Your finished task, your process shown, and your own judgement of what you wanted, what happened, and the gap.',
  CORRECT: 'Your fix-it list with cause, change and proof, both versions side by side, and one thing you will do differently.',
}

/** Grades that receive the elementary register. */
export const ELEMENTARY_GRADES = new Set([3, 4, 5])
