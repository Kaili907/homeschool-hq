// G34-M5 — Grade 3/4 Physical Education course data.
//
// Standards anchors use the Michigan K-12 Physical Education Standards
// (State Board approved May 2017), which carry five standards. Anchors are
// written as full labels; the published Grade 5-8 courses encode standards 2-5
// as bare strings ("2", "4"), which the v2 compatibility importer classifies
// CONTENT_CORRECTION_REQUIRED. These courses do not repeat that defect.
//
// Each topic carries its own teaching content: `cues` are the movement cues the
// session actually teaches, and `common_error` names what typically goes wrong
// and the correction. Topic order is deliberate — the topic needing the most
// direct instruction sits at index 1, which the twelve-day arc maps to the
// first concept-model session.

export const PE = {
  1: 'Michigan PE Standard 1: Demonstrates competency in a variety of motor skills and movement patterns',
  2: 'Michigan PE Standard 2: Applies knowledge of concepts, principles, strategies and tactics related to movement and physical activities',
  3: 'Michigan PE Standard 3: Demonstrates the knowledge and skills to achieve and maintain a health-enhanced level of physical fitness',
  4: 'Michigan PE Standard 4: Exhibits responsible personal and social behavior that respects self and others',
  5: 'Michigan PE Standard 5: Recognizes the value of physical activity for health, enjoyment, challenge, self-expression and/or other benefits',
}

const G = {
  indoorOpen: {
    equipment: 'Open floor space clear of furniture and trip hazards; non-slip footwear or bare feet on a safe surface.',
    environment: 'Indoor open space, gym, or a cleared room. An outdoor lawn may be substituted.',
    movement_hazards: 'Running and stopping in shared space. Guardian confirms the area is clear, the floor is not slippery, and boundaries are marked before the session.',
    food_or_allergy_note: null,
    guardian_confirmation_required: true,
  },
  mats: {
    equipment: 'A mat, carpet, folded blanket, or grass for any weight-bearing or rolling work. No hard or uneven surface.',
    environment: 'Indoor open space with a padded surface, or a level grassy outdoor area.',
    movement_hazards: 'Balance, rolling, and weight transfer carry a fall risk. An adult supervises directly, spots where needed, and no learner attempts an inversion or a skill they have not been taught.',
    food_or_allergy_note: null,
    guardian_confirmation_required: true,
  },
  objects: {
    equipment: 'Soft, lightweight balls, beanbags, or rolled socks. No hard, heavy, or fast-moving balls indoors.',
    environment: 'Indoor open space or a supervised outdoor area with a clear throwing lane away from windows, roads, and bystanders.',
    movement_hazards: 'Thrown and struck objects can strike a person or property. Guardian sets the target direction and a no-go zone, and confirms nobody stands in the path.',
    food_or_allergy_note: null,
    guardian_confirmation_required: true,
  },
  implements: {
    equipment: 'Short-handled paddle, lightweight racquet, foam bat, or a hand as the striking surface; balloon or soft ball only.',
    environment: 'Indoor open space with high clearance, or a supervised outdoor area away from windows and bystanders.',
    movement_hazards: 'Swinging an implement can strike a nearby person. Guardian establishes a swing-radius safety space and confirms it is clear before each turn.',
    food_or_allergy_note: 'Latex balloons are a known allergen and a choking hazard for younger siblings; substitute a soft foam ball where needed.',
    guardian_confirmation_required: true,
  },
  rhythm: {
    equipment: 'Music source at a safe volume; jump rope of correct length if used.',
    environment: 'Indoor open space with clearance overhead and to the sides.',
    movement_hazards: 'Rope work carries a trip and strike risk; the rope must match the learner height and be used with clear space around them.',
    food_or_allergy_note: null,
    guardian_confirmation_required: true,
  },
  fitness: {
    equipment: 'Body-weight activity only; water available throughout. No weights, no measurement device, no fitness-test equipment.',
    environment: 'Indoor open space or a supervised outdoor area with shade and water access.',
    movement_hazards: 'Sustained activity raises heart rate and body temperature. Guardian confirms hydration, allows rest at any time, and adjusts for heat, asthma, or any medical guidance already in place.',
    food_or_allergy_note: 'Guardian applies any existing medical guidance for exercise-related asthma, allergy, or condition. The course never asks for the diagnosis itself.',
    guardian_confirmation_required: true,
  },
  outdoorGames: {
    equipment: 'Cones or markers, soft balls, and any protective gear the chosen activity needs.',
    environment: 'Supervised outdoor area or indoor open space, away from roads, water, and parking areas.',
    movement_hazards: 'Small-sided play involves changing direction near others, with collision risk. Guardian sets boundaries, group size, and contact rules, and checks the surface and weather before play.',
    food_or_allergy_note: 'Provide water for outdoor sessions; check any insect-sting or seasonal-allergy plan already in place.',
    guardian_confirmation_required: true,
  },
}

const A = {
  space:
    'Every travel task has a seated, supported, or reduced-range version: a learner may move through space in a wheelchair or walker, travel a shorter path, use arms only, or trace the pathway with a pointer or on paper. Speed is never the target; control is. Where a task mentions a group or a partner, a learner may work with one adult instead, or plan and justify it on paper, and that counts fully.',
  locomotor:
    'Each locomotor pattern has an equivalent the learner can perform: arm-driven or wheelchair propulsion for travel, seated marching or stepping in place for hop and gallop, and rhythm tapping for skip. Distance, height, and repetition are always adjustable and never compared between learners.',
  balance:
    'Balance work may be done seated, kneeling, with a chair or wall for support, or with an adult spotting. Any weight-bearing or rolling task may be replaced with a supported hold, a shape made with the arms, or describing the body positions that make a balance stable.',
  object:
    'Throwing, catching, and object control may use a larger, lighter, slower, or bounced object; a shorter distance; a rolled rather than thrown delivery; a scoop or two hands; or a stationary target. A learner may also direct a partner and analyze the result instead of performing the skill.',
  foot:
    'Foot-skill tasks may be done with a stationary ball, a slower rolled ball, a larger ball, a hand or assistive device in place of the foot, or from a seated position. Travel distance is always adjustable.',
  strike:
    'Striking may use a hand, a short paddle, or a long implement; a balloon, beach ball, or ball on a tee; and a shorter or seated swing. A learner may also call the contact point and follow-through for a partner instead of striking.',
  rhythm:
    'Rhythm tasks may be performed with the whole body, with the upper body only, seated, with a single limb, or by tapping or counting the beat. Sequences may be shortened, slowed, or described rather than performed. Sharing a sequence is always optional and is never done in front of an audience.',
  fitness:
    'Every fitness activity has a lower-impact, seated, and shorter-duration version. Intensity is chosen by the learner using their own sense of effort. No learner is timed against another, ranked, or measured; there is no fitness test, no score, and no body measurement.',
  game:
    'Games are adapted so every learner has a real role: adjustable boundaries, extra passes, a designated safe zone, a slower or larger object, a seated or stationary position, and role options including player, coach, official, or strategist. Any rule may be changed to include a learner rather than excluding them. Where a task asks the learner to lead or officiate, they may lead one adult, officiate a scripted scenario, or write and justify the plan instead; leading is never done in front of an audience.',
}

export const COURSES = [
  {
    grade: 3,
    courseId: 'ma-g3-physical-education',
    title: 'Grade 3 Physical Education',
    description:
      'An inclusive Grade 3 physical education course aligned to the Michigan K-12 Physical Education Standards. It builds safe participation habits, space awareness and body control, the locomotor and manipulative skills named in the standards, rhythm and creative movement, fitness understanding based on personal effort, and cooperative fair play. Every task carries an adapted alternative. No body measurement, fitness test, timing, repetition or distance score, ranking, camera or video proof, or public performance is ever required.',
    capstone:
      'A personal movement portfolio: a self-selected skill practised over time, an inclusive game the learner adapted so everyone can play, and a plan for activity the learner actually enjoys. Shared privately with a guardian or facilitator; no recording, audience, or public performance is required.',
    units: [
      {
        title: 'Safe Movement, Space Awareness, and Body Control',
        standards: [PE[1], PE[2], PE[4]],
        essentialQuestion: 'How do I move safely and stay in control of my body in shared space?',
        performanceTask: 'Lead an adult or partner through a safe movement warm-up and an area safety check, explaining the reason for each choice.',
        adapted: A.space, guardian: G.indoorOpen,
        topics: [
          { name: 'self-space and general space', cues: ['Self-space is the bubble you can reach into without touching anyone.', 'General space is the whole area everyone shares.', 'Eyes up and scanning, not down at your feet.', 'Leave a gap you could fit through between you and the next person.'], common_error: 'Learners drift into others because they watch the floor. Fix: give a fixed point to glance up at each time they change direction.' },
          { name: 'starting, stopping, and dodging', cues: ['Stop with feet apart, knees bent, weight low — a ready position.', 'Slow down over two or three steps rather than locking the legs.', 'Dodge by pushing off the outside foot and changing direction sharply.', 'Look where you are going, not at what you are dodging.'], common_error: 'Stopping with straight legs and a high body, which slides or topples. Fix: call "freeze" often and check for bent knees and a low centre.' },
          { name: 'directions and pathways', cues: ['Directions: forwards, backwards, sideways, up, down.', 'Pathways: straight, curved, zigzag.', 'Say the pathway out loud before you travel it.', 'Curved and zigzag pathways need you to slow slightly before the turn.'], common_error: 'Zigzag becomes a gentle curve. Fix: mark sharp corners with cones and require a visible change of direction at each.' },
          { name: 'levels and speed', cues: ['Levels: low near the floor, medium at standing height, high on toes or reaching.', 'Speed is a choice you control, not a competition.', 'Changing level or speed changes how much control you need.', 'Match speed to the space: crowded means slower.'], common_error: 'Treating fast as always better. Fix: set tasks that can only be completed slowly and controlled, and praise the control.' },
          { name: 'warm-up and cool-down routines', cues: ['Warm-up starts gently and gradually raises heart rate and warms muscles.', 'Move the joints you are about to use.', 'Cool-down slows the body down and includes gentle stretching.', 'Never go from still to full speed, or from full speed to still.'], common_error: 'Static stretching cold before any movement. Fix: raise the temperature with easy movement first, then move joints through range.' },
          { name: 'safe equipment and activity-area checks', cues: ['Check the surface for water, grit, cables, and objects.', 'Check the boundaries and what is just outside them.', 'Check equipment for damage before use.', 'Check yourself: laces tied, nothing loose or dangling.'], common_error: 'Checking only the floor and missing what is beyond the boundary, such as a wall or a road. Fix: teach a four-part check said aloud each session.' },
        ],
      },
      {
        title: 'Locomotor and Non-Locomotor Skills',
        standards: [PE[1], PE[2]],
        essentialQuestion: 'How does each way of travelling work, and when is each one useful?',
        performanceTask: 'Build and perform a short travel sequence that uses at least four different locomotor patterns and two pathways, and explain the cue you relied on most.',
        adapted: A.locomotor, guardian: G.indoorOpen,
        topics: [
          { name: 'walking and running form', cues: ['Look ahead, not down.', 'Arms swing forward and back from the shoulder, not across the body.', 'Land through the foot rather than slapping it down.', 'Stay tall through the body; do not bend forward at the waist.'], common_error: 'Arms swinging across the chest, which turns the body and wastes effort. Fix: cue "elbows brush your sides".' },
          { name: 'hopping, jumping, and safe landings', cues: ['A hop takes off and lands on the same foot; a jump uses two feet.', 'Swing the arms up to help you leave the ground.', 'Land quietly, toes first then heels, with knees bending to absorb it.', 'Landing softly protects your joints — noise means the landing was hard.'], common_error: 'Landing with straight, stiff legs. Fix: use "land like a cat" and listen for how quiet the landing is.' },
          { name: 'skipping, galloping, and sliding', cues: ['A gallop keeps the same foot leading; a slide is a sideways gallop.', 'A skip is a step and a hop on the same foot, then the other side.', 'Stay light and rhythmic rather than heavy.', 'Practise galloping on both leading feet, not only your favourite.'], common_error: 'Only ever leading with one foot. Fix: call a switch halfway across, every time.' },
          { name: 'leaping and chasing, fleeing, dodging', cues: ['A leap takes off from one foot and lands on the other, with a moment of flight.', 'When fleeing, use the whole space rather than running in a straight line.', 'When chasing, watch the hips — hips show the real direction before the head does.', 'Agree the tag rule before starting: gentle, two fingers, on the shoulder or back.'], common_error: 'Tagging hard or grabbing clothing. Fix: stop the game immediately, restate the rule, and restart.' },
          { name: 'twisting, bending, and stretching shapes', cues: ['Non-locomotor movement happens without travelling.', 'Twist rotates around your middle; bend closes a joint; stretch opens the body out.', 'Move into a shape slowly and hold it still.', 'Nothing should hurt — stretch to mild tension, never to pain.'], common_error: 'Bouncing into a stretch. Fix: hold still and breathe; bouncing does not increase range and risks strain.' },
          { name: 'combining locomotor patterns', cues: ['Link patterns with a clear change, not a stumble.', 'Plan the order before you move.', 'Use a different pathway or level for each part to make the sequence readable.', 'Repeat the sequence the same way twice — repeatable means controlled.'], common_error: 'Rushing so the transitions blur together. Fix: require a held still shape between each pattern at first, then remove it.' },
        ],
      },
      {
        title: 'Balance, Stability, and Weight Transfer',
        standards: [PE[1], PE[2], PE[4]],
        essentialQuestion: 'What makes a balance stable, and how do I move my weight safely?',
        performanceTask: 'Create a three-balance sequence with smooth transitions and explain what makes each balance stable.',
        adapted: A.balance, guardian: G.mats,
        topics: [
          { name: 'static balance and bases of support', cues: ['A base of support is whatever is touching the floor.', 'A wider base and a lower body are more stable.', 'Fix your eyes on one still point.', 'Squeeze the muscles — a tight body wobbles less than a loose one.'], common_error: 'Looking around while balancing. Fix: choose a spot on the wall and name it before starting.' },
          { name: 'body tension and control', cues: ['Tension means holding the shape on purpose, not being stiff or rigid.', 'Point toes and extend fingers to finish a shape.', 'Hold a balance still for three seconds before moving on.', 'Breathe while holding; holding your breath makes you wobble.'], common_error: 'Floppy shapes that collapse. Fix: cue "stretch to your fingertips and toes" and count the hold aloud.' },
          { name: 'dynamic balance while travelling', cues: ['Arms out to the sides help you correct as you move.', 'Move slowly along a line or low beam.', 'Keep your eyes ahead, not on your feet.', 'Step through the whole foot rather than tiptoeing nervously.'], common_error: 'Speeding up to get it over with, which loses control. Fix: set the target as slow and steady, never as fast.' },
          { name: 'safe rolling and body positions', cues: ['Tuck the chin to the chest — never roll on the head or neck.', 'Curl the back round so you roll smoothly.', 'Hold the tuck: knees in, hands in.', 'Roll only on a mat or grass, and only with an adult watching.'], common_error: 'Head contact from an untucked chin. Fix: stop, rebuild the tuck from a seated rock, and progress only when the chin stays down.' },
          { name: 'transferring weight from feet to hands', cues: ['Hands flat and fingers spread, shoulder-width apart.', 'Take weight briefly, then return the feet to the floor.', 'Keep the shoulders over the hands.', 'Start low with a bunny hop; never attempt an inversion you have not been taught.'], common_error: 'Bent, collapsing arms. Fix: return to a supported low position and build strength before adding height.' },
          { name: 'linking balances into a sequence', cues: ['Choose balances that use different bases of support.', 'The transition matters as much as the balance.', 'Move slowly and deliberately between shapes.', 'A sequence has a clear start position and a clear finish.'], common_error: 'Three near-identical balances. Fix: require a different number of body parts on the floor for each one.' },
        ],
      },
      {
        title: 'Throwing and Catching',
        standards: [PE[1], PE[2]],
        essentialQuestion: 'How do I send and receive an object accurately?',
        performanceTask: 'Complete a personal throw-and-catch challenge at a distance you choose, and name which cue made your throw and your catch more controlled. Nothing is counted, timed, or recorded as a score.',
        adapted: A.object, guardian: G.objects,
        topics: [
          { name: 'underhand throw for accuracy', cues: ['Step forward with the foot opposite your throwing hand.', 'Swing the arm straight back then straight through, like a pendulum.', 'Release at about waist height.', 'Follow through with the hand pointing at the target.'], common_error: 'Stepping with the same-side foot, which blocks the hips. Fix: mark the opposite foot with a spot to step onto.' },
          { name: 'overhand throw mechanics', cues: ['Turn side-on to the target.', 'Throwing elbow high, hand back behind the head.', 'Step with the opposite foot, then rotate hips and shoulders through.', 'Follow through across the body towards the opposite hip.'], common_error: 'Throwing front-on with the arm only, which is weak and inaccurate. Fix: start every throw from a side-on stance with the non-throwing arm pointing at the target.' },
          { name: 'catching above and below the waist', cues: ['Above the waist: thumbs together, fingers up.', 'Below the waist: little fingers together, fingers down.', 'Watch the object all the way into your hands.', 'Give with the catch — pull the hands in to absorb it softly.'], common_error: 'Closing the eyes or turning the head away. Fix: use a soft, slow, larger object until the learner keeps their eyes on it.' },
          { name: 'tracking a moving object', cues: ['Pick the object up early, as it leaves the thrower hand.', 'Move your feet to get behind its line rather than reaching sideways.', 'Keep your head still and let your eyes do the following.', 'Get your hands ready before it arrives, not as it arrives.'], common_error: 'Standing still and stretching an arm out. Fix: cue "feet first, hands second" and reward good positioning over a lucky grab.' },
          { name: 'throwing to a partner or target', cues: ['Aim at the receiver hands, or at a marked spot on a wall.', 'Match the power to the distance — harder is not better.', 'Say the receiver name before you throw.', 'Wait until they are ready and looking.'], common_error: 'Throwing before the partner is ready. Fix: require eye contact and a called name before every throw.' },
          { name: 'combining throwing and catching', cues: ['Catch, then reset your feet before you throw back.', 'Keep a steady rhythm rather than rushing.', 'Communicate: call for it, then call before you send it.', 'Cooperate to keep it going, rather than trying to catch each other out.'], common_error: 'Throwing immediately from an off-balance catch. Fix: insert a deliberate pause and foot reset between catching and throwing.' },
        ],
      },
      {
        title: 'Kicking, Trapping, and Dribbling with the Feet',
        standards: [PE[1], PE[2]],
        essentialQuestion: 'How do I control an object with my feet?',
        performanceTask: 'Design and complete a foot-skill course with a partner or an adult, naming the cue that helped most at each station.',
        adapted: A.foot, guardian: G.objects,
        topics: [
          { name: 'stationary kick for accuracy', cues: ['Place the non-kicking foot beside the ball, pointing at the target.', 'Strike with the inside of the foot for accuracy.', 'Keep the head down and eyes on the ball at contact.', 'Follow through towards the target.'], common_error: 'Toe-poking, which is inaccurate and hurts. Fix: mark the inside of the shoe and require contact there.' },
          { name: 'trapping and controlling a rolling ball', cues: ['Get your body in line with the ball as it comes.', 'Meet it with the inside of the foot.', 'Relax the foot on contact and withdraw slightly to cushion it.', 'Aim to stop it within one step of yourself.'], common_error: 'A rigid foot, so the ball rebounds away. Fix: cue "soft foot, give with it", as with catching.' },
          { name: 'approach kick and follow-through', cues: ['Take a short angled approach of one or two steps.', 'Plant the non-kicking foot beside the ball.', 'Strike through the middle of the ball.', 'Let the kicking leg swing through rather than stopping at contact.'], common_error: 'Stopping the leg at impact, which kills the power. Fix: cue a full swing and a landing step onto the kicking foot.' },
          { name: 'dribbling with the inside of the foot', cues: ['Small, light touches — keep the ball close.', 'Use both feet, not just your favourite.', 'Glance up between touches to see the space.', 'If it goes further than a step away, it is a pass, not a dribble.'], common_error: 'One big kick then a chase. Fix: set a rule of a touch every two steps within a narrow lane.' },
          { name: 'changing direction while dribbling', cues: ['Slow down slightly before the turn.', 'Use the inside or sole of the foot to redirect the ball.', 'Turn your body with the ball, keeping it between you and the space.', 'Accelerate again once the ball is under control.'], common_error: 'Turning the body first and leaving the ball behind. Fix: cue "ball first, then you".' },
          { name: 'cooperative foot-skill tasks', cues: ['Pass to your partner feet, not into space they cannot reach.', 'Call before you pass.', 'Match the weight of the pass to the distance.', 'Work together to keep it going, not to beat each other.'], common_error: 'Over-hitting a short pass. Fix: set a target of the partner controlling it in one touch, which forces weight adjustment.' },
        ],
      },
      {
        title: 'Striking with Hands and Short Implements',
        standards: [PE[1], PE[2]],
        essentialQuestion: 'How do I make solid, controlled contact with an object?',
        performanceTask: 'Sustain a cooperative rally with a partner or against a wall, and explain the contact point and follow-through that kept it going.',
        adapted: A.strike, guardian: G.implements,
        topics: [
          { name: 'striking a balloon or light ball with the hands', cues: ['Watch the object all the way onto your hand.', 'Strike with a flat, firm surface.', 'Contact underneath to send it upward.', 'Reset under it between hits.'], common_error: 'Swiping sideways so the object flies away. Fix: use a balloon and require it to go straight up first.' },
          { name: 'underhand striking upward for control', cues: ['Keep the striking hand below the object.', 'Use a short, controlled swing rather than a big one.', 'Contact under the middle so it rises straight.', 'Move your feet to stay underneath it.'], common_error: 'Standing still and reaching. Fix: require the learner to be directly beneath the object at contact.' },
          { name: 'striking with a short-handled paddle', cues: ['Shake-hands grip, thumb along the handle, wrist firm.', 'Hold the paddle out in front where you can see it and the object together.', 'Turn side-on to the direction you are striking.', 'Keep the swing short and controlled.'], common_error: 'Gripping too tightly, which stiffens the swing. Fix: cue a grip firm enough to hold, loose enough to be taken from you.' },
          { name: 'forehand contact and follow-through', cues: ['Take the paddle back early, before the object arrives.', 'Contact in front of your body, not beside or behind it.', 'Swing low to high to lift the object.', 'Finish with the paddle pointing where you want it to go.'], common_error: 'Late contact beside the body, which loses control. Fix: mark a contact spot on the floor in front and require contact over it.' },
          { name: 'striking to a wall or target', cues: ['Choose a target and name it before striking.', 'Match the force to the distance.', 'Reset to the ready position after each strike.', 'Let it bounce once if that helps you stay controlled.'], common_error: 'Hitting as hard as possible so the rebound is unplayable. Fix: set the goal as three controlled strikes in a row, not one big one.' },
          { name: 'cooperative rallying', cues: ['Aim to your partner, so they can reach it.', 'Talk: call "yours" and "mine".', 'Let it bounce if that keeps the rally alive.', 'Count how long you can keep it going together, not who won.'], common_error: 'Playing to win against a partner in a cooperative task. Fix: restate that the shared rally is the goal, and reset the count together.' },
        ],
      },
      {
        title: 'Rhythm, Beat, and Creative Movement',
        standards: [PE[1], PE[2], PE[5]],
        essentialQuestion: 'How does movement fit with beat, tempo, and expression?',
        performanceTask: 'Create a short movement sequence set to a steady beat and describe its pattern. Showing it to anyone is optional and is never done in front of an audience.',
        adapted: A.rhythm, guardian: G.rhythm,
        topics: [
          { name: 'moving to a steady beat', cues: ['Find the beat by listening before you move.', 'Clap or tap it first, then step it.', 'Keep steps even and the same size.', 'Count in groups of four to stay together.'], common_error: 'Speeding up over time. Fix: keep clapping quietly while stepping so the beat stays external.' },
          { name: 'simple movement patterns and repetition', cues: ['A pattern is a set of moves in a fixed order.', 'Repeat it so it becomes recognisable.', 'Say the pattern aloud while doing it.', 'Keep it short — four or eight counts is plenty.'], common_error: 'Changing the pattern each time, so it is never learned. Fix: require three identical repetitions before adding anything.' },
          { name: 'tempo changes, fast and slow', cues: ['Tempo is how fast the beat is.', 'The same movement at a slower tempo needs more control.', 'Change tempo on a signal, not gradually by drifting.', 'Slow does not mean floppy — keep the shape.'], common_error: 'Losing the shape when slowing down. Fix: practise the sequence at half speed with held positions.' },
          { name: 'jump rope and rhythmic skills', cues: ['Rope length: stand on the middle, handles reach the armpits.', 'Turn from the wrists, not the whole arm.', 'Small jumps, just clearing the rope; land softly.', 'Start by swinging the rope to one side and jumping the rhythm without it.'], common_error: 'Huge jumps that tire quickly and land hard. Fix: cue "just off the floor" and check for quiet landings.' },
          { name: 'creative and expressive movement', cues: ['Movement can show an idea, a mood, or a story.', 'Use level, speed, and size to change the feeling.', 'Stillness is part of the movement.', 'There is no wrong answer in a creative task.'], common_error: 'Copying someone else because of uncertainty. Fix: give a starting constraint, such as one shape and one pathway, so an original response is easier.' },
          { name: 'sharing a short sequence by choice', cues: ['Sharing is always the performer choice.', 'You may show it to one trusted adult only.', 'Describing the sequence counts as fully as performing it.', 'Give feedback about the movement, never about the person.'], common_error: 'Assuming everyone will perform for the group. Fix: offer describe, show to one adult, or opt out, as equal options from the start.' },
        ],
      },
      {
        title: 'Fitness Concepts, Effort, and Recovery',
        standards: [PE[3], PE[5]],
        essentialQuestion: 'What does activity do for my body, and how do I judge my own effort?',
        performanceTask: 'Assemble a personal activity circuit you enjoy, with an easier and a harder option for each station, and explain how you judge your own effort.',
        adapted: A.fitness, guardian: G.fitness,
        topics: [
          { name: 'what the heart and lungs do during activity', cues: ['The heart pumps blood; the lungs add oxygen to it.', 'During activity both work harder, so breathing and heartbeat speed up.', 'That change is the body doing its job, not a problem.', 'Regular activity makes the heart stronger over time.'], common_error: 'Believing that being out of breath means something is wrong. Fix: explain it as a normal, temporary response that settles during cool-down.' },
          { name: 'noticing my own effort level', cues: ['Use the talk test: easy means you can chat, medium means short sentences, hard means a few words.', 'Effort is personal — the same activity feels different to different people.', 'Nobody else can tell you what your effort feels like.', 'Stop if you feel dizzy, sharp pain, or cannot catch your breath, and tell an adult.'], common_error: 'Comparing effort with someone else. Fix: keep the talk test entirely self-referenced and never discuss whose was higher.' },
          { name: 'muscular strength and endurance activities', cues: ['Strength is one hard effort; endurance is keeping going.', 'Body-weight moves are enough — no weights are needed.', 'Control the movement rather than rushing it.', 'Stop when your form breaks down.'], common_error: 'Rushing to do as many as possible. Fix: set the goal as controlled movement, and stop at the point form changes, never at a number.' },
          { name: 'flexibility and mobility', cues: ['Flexibility is how far a joint can move comfortably.', 'Stretch when already warm, never cold.', 'Hold a gentle stretch and breathe.', 'Mild tension is fine; pain is not.'], common_error: 'Forcing a stretch to reach further than a friend. Fix: state that range is individual and comparison is meaningless.' },
          { name: 'hydration, rest, and recovery', cues: ['Drink water before, during, and after activity.', 'Rest days are part of training, not a failure of it.', 'Sleep is when the body repairs.', 'Muscle soreness a day later is normal; sharp pain during activity is not.'], common_error: 'Treating rest as laziness. Fix: teach recovery as a component of fitness in its own right.' },
          { name: 'enjoying activity every day', cues: ['Around an hour a day, and it can be split up.', 'It counts whether it is sport, play, chores, or walking.', 'The activity you enjoy is the one you will keep doing.', 'Activity helps mood and sleep as well as the body.'], common_error: 'Believing only sport counts. Fix: have the learner list a week of movement and notice how much already qualifies.' },
        ],
      },
      {
        title: 'Cooperative Games, Fair Play, and Lifetime Activity',
        standards: [PE[2], PE[4], PE[5]],
        essentialQuestion: 'How do fair rules and good teamwork make activity better for everyone?',
        performanceTask: 'Adapt a familiar game so a learner with a different ability, size, or energy level can fully take part, then play it and review what worked.',
        adapted: A.game, guardian: G.outdoorGames,
        topics: [
          { name: 'following rules and playing fairly', cues: ['Rules exist to keep play safe and fair for everyone.', 'Agree the rules before starting, not during an argument.', 'Call your own faults honestly.', 'Winning by cheating is not winning.'], common_error: 'Renegotiating rules mid-game when losing. Fix: agree and restate the rules aloud before the first point.' },
          { name: 'adapting a game so everyone can play', cues: ['Change the equipment, the space, or the rules — not the person.', 'Ask the player what would help rather than guessing.', 'Extra passes, bigger targets, and safe zones include people without singling them out.', 'A good adaptation keeps the game fun for everyone.'], common_error: 'Giving someone an easier role that removes them from the real game. Fix: check that the adaptation keeps them in the main action, and ask them whether it does.' },
          { name: 'cooperation and communication', cues: ['Call for the object and call before you send it.', 'Use names.', 'Encourage after mistakes, not only after successes.', 'Listen to the quieter voices in the group.'], common_error: 'One confident player directing everyone. Fix: rotate a role where a different player decides the plan each round.' },
          { name: 'roles and turn-taking', cues: ['Rotate positions so everyone experiences each role.', 'Everyone gets the object regularly.', 'Sitting out is a rest, not a punishment.', 'Officials and coaches are real roles, not consolation prizes.'], common_error: 'The same person always in the key position. Fix: use a fixed rotation on a timer.' },
          { name: 'resolving disagreements kindly', cues: ['Stop play and talk rather than shouting.', 'Describe what happened, not who is bad.', 'Look for a fair restart both can accept.', 'If you cannot agree, replay the point.'], common_error: 'Arguing to win rather than to restart. Fix: teach the replay as the default and make it fast.' },
          { name: 'activities to enjoy outside class', cues: ['Lifetime activities include walking, cycling, swimming, dance, and climbing.', 'Local options may include parks, clubs, and community centres.', 'Cost and transport can be barriers; an adult can help find options.', 'Choose by enjoyment, because enjoyment is what makes it last.'], common_error: 'Assuming activity requires a club or equipment. Fix: build a list of free, local, low-equipment options with an adult.' },
        ],
      },
    ],
  },
  {
    grade: 4,
    courseId: 'ma-g4-physical-education',
    title: 'Grade 4 Physical Education',
    description:
      'An inclusive Grade 4 physical education course aligned to the Michigan K-12 Physical Education Standards. It advances Grade 3 by adding dynamic space, skill combinations under light pressure, tactical decision-making in small-sided play, movement composition, and personal activity planning built on effort rather than measurement. Every task carries an adapted alternative. No body measurement, fitness test, timing, repetition or distance score, ranking, camera or video proof, or public performance is ever required.',
    capstone:
      'A personal activity portfolio: one skill developed through deliberate practice, one inclusive small-sided game the learner designed, and a personal activity plan built on enjoyment, safety, and access. Shared privately with a guardian or facilitator; no recording, audience, or public performance is required.',
    units: [
      {
        title: 'Movement Foundations and Safe Participation Routines',
        standards: [PE[1], PE[2], PE[4]],
        essentialQuestion: 'What routines keep people safe and ready to move well?',
        performanceTask: 'Design and lead a warm-up, area check, and cool-down for an adult or a group, justifying each element. A learner may instead write the plan and justify it.',
        adapted: A.space, guardian: G.indoorOpen,
        topics: [
          { name: 'self-space and general space under pressure', cues: ['Scan continuously; the space changes as others move.', 'Move into gaps rather than following the crowd.', 'Keep your head up even while controlling an object.', 'Anticipate where a gap will be, not where it is now.'], common_error: 'Watching only the nearest person. Fix: set tasks requiring learners to call out a far gap before travelling to it.' },
          { name: 'speed, force, and controlled stopping', cues: ['Force is how hard you move; speed is how fast.', 'More speed needs more distance to stop safely.', 'Decelerate over several steps with a low, wide base.', 'Match force to the task — maximum is rarely correct.'], common_error: 'Full-speed running in a small space. Fix: shrink the area deliberately and require a controlled stop on signal.' },
          { name: 'pathways, directions, and levels in combination', cues: ['Combine a pathway with a direction and a level for a richer movement.', 'Plan the combination before moving.', 'Changes should be visible to a watcher.', 'Repeat combinations to make them reliable.'], common_error: 'Combinations blur into a jog. Fix: require a watcher to name the pathway, direction, and level they saw.' },
          { name: 'purposeful warm-up and cool-down design', cues: ['A warm-up should build gradually and prepare the specific joints you will use.', 'Match the warm-up to the activity that follows.', 'Cool-down lowers the heart rate progressively, then stretches.', 'Explain why each part is included.'], common_error: 'A generic warm-up unrelated to the session. Fix: require one movement in the warm-up that mirrors the main skill.' },
          { name: 'equipment checks and safe setup', cues: ['Inspect equipment for damage, wear, and correct size.', 'Set up so nothing blocks a run-out or exit.', 'Leave space between stations.', 'Everyone knows the stop signal before starting.'], common_error: 'Stations placed too close, so run-outs overlap. Fix: walk the run-out of each station during setup.' },
          { name: 'personal responsibility for the shared space', cues: ['Return equipment where it belongs.', 'Report damage rather than leaving it.', 'Look out for people around you, not just yourself.', 'Leave the area as safe as you found it.'], common_error: 'Leaving equipment out mid-session, creating trip hazards. Fix: assign a rotating equipment role each session.' },
        ],
      },
      {
        title: 'Locomotor Combinations, Pathways, and Dynamic Space',
        standards: [PE[1], PE[2]],
        essentialQuestion: 'How do I combine travel patterns and read space that keeps changing?',
        performanceTask: 'Perform a travel sequence through a changing space and explain how you found and used open space.',
        adapted: A.locomotor, guardian: G.indoorOpen,
        topics: [
          { name: 'combining locomotor patterns in sequence', cues: ['Transitions should be smooth, with no stumble or pause.', 'Change pattern on a count or a signal.', 'Vary level and pathway between patterns.', 'A repeatable sequence is a controlled one.'], common_error: 'Losing rhythm at the changeover. Fix: practise just the two-pattern join in isolation.' },
          { name: 'travelling to open space', cues: ['Open space is where defenders and other players are not.', 'Move to space before you receive, not after.', 'Communicate that you are moving there.', 'Space closes quickly — commit once you decide.'], common_error: 'Standing still and calling for the object. Fix: require the learner to be moving as they call.' },
          { name: 'changing direction and pathway at speed', cues: ['Lower your body slightly before cutting.', 'Push off the outside foot.', 'Make the change sharp and definite.', 'Accelerate out of the turn.'], common_error: 'Rounded turns that give away the intention. Fix: use cone gates that force a sharp angle.' },
          { name: 'chasing, fleeing, and dodging in shared space', cues: ['When fleeing, use changes of direction and speed, not just straight running.', 'When chasing, watch the hips.', 'Fake one way and go the other.', 'Keep tags gentle and agreed.'], common_error: 'Fleeing in straight lines into corners. Fix: mark corner zones as out of play.' },
          { name: 'jumping and landing with control', cues: ['Swing arms up on take-off.', 'Land on two feet where possible, toes then heels.', 'Bend knees and hips to absorb.', 'Land balanced and ready to move again.'], common_error: 'Landing on one stiff leg. Fix: require a held two-foot landing for three seconds before continuing.' },
          { name: 'reading and reacting to a moving partner', cues: ['Watch the whole person, not just the object.', 'Mirror and match a partner movement to practise reacting.', 'React to what they do, rather than guessing early.', 'Stay balanced so you can move either way.'], common_error: 'Committing early and being beaten by a fake. Fix: play mirror games with no object so reading is the only task.' },
        ],
      },
      {
        title: 'Balance, Weight Transfer, and Gymnastics Foundations',
        standards: [PE[1], PE[2], PE[4]],
        essentialQuestion: 'How do I control my body weight through a movement sequence?',
        performanceTask: 'Build and refine a smooth sequence linking balance, travel, and a shape, and explain the safety choices in it.',
        adapted: A.balance, guardian: G.mats,
        topics: [
          { name: 'balances on different bases of support', cues: ['Vary the number and type of body parts on the floor.', 'Fewer points of contact is harder, not better.', 'Keep the body tight and extended.', 'Hold for three seconds to prove control.'], common_error: 'Choosing only easy, wide balances. Fix: require a stated number of contact points, varied across the sequence.' },
          { name: 'spotting, safety, and knowing my limits', cues: ['Never attempt a new skill without an adult present.', 'A spotter stands where they can actually help.', 'Mats go where you will land, not where you start.', 'Choosing not to attempt something is a good decision, not a failure.'], common_error: 'Copying a skill seen online without progression. Fix: state the rule that new skills are taught in steps, with an adult, on a mat.' },
          { name: 'dynamic balance and controlled travel', cues: ['Travel slowly along a line or low surface.', 'Arms out to aid correction.', 'Eyes ahead on a fixed point.', 'Keep the body tall and centred over the base.'], common_error: 'Rushing along the beam. Fix: set the success criterion as slow and unwobbling.' },
          { name: 'safe rolling and landing technique', cues: ['Chin tucked, back rounded, never on the head or neck.', 'Hands placed to guide, not to take the whole weight.', 'Roll along the length of the spine.', 'Only on mats or grass, with an adult watching.'], common_error: 'Rolling sideways off the mat. Fix: mark a straight lane and require the roll to finish inside it.' },
          { name: 'weight transfer, feet to hands to feet', cues: ['Hands flat, fingers spread, shoulders stacked over hands.', 'Take weight briefly and return under control.', 'Keep arms straight and strong.', 'Build height gradually across sessions.'], common_error: 'Kicking up too hard and over-rotating. Fix: work against a low support and limit height until the arms hold reliably.' },
          { name: 'linking balance, travel, and shape into a sequence', cues: ['A sequence needs a clear beginning, middle, and end.', 'Transitions are part of the sequence, not gaps in it.', 'Contrast level, speed, and shape to make it readable.', 'Refine by repeating and adjusting one thing at a time.'], common_error: 'Adding more elements instead of improving the existing ones. Fix: cap the number of elements and require two refinement passes.' },
        ],
      },
      {
        title: 'Throwing, Catching, and Object Control Under Pressure',
        standards: [PE[1], PE[2]],
        essentialQuestion: 'How does accuracy hold up when speed, distance, or a defender is added?',
        performanceTask: 'Complete an object-control challenge that adds distance and light pressure, and explain which cue mattered most and why. Nothing is counted, timed, or recorded as a score.',
        adapted: A.object, guardian: G.objects,
        topics: [
          { name: 'overhand throw for distance and accuracy', cues: ['Side-on stance, non-throwing arm pointing at the target.', 'High elbow, hand back.', 'Drive from the legs, rotate hips then shoulders.', 'Follow through across the body.'], common_error: 'Arm-only throwing with no rotation. Fix: exaggerate the side-on start and require the chest to finish facing the target.' },
          { name: 'choosing the right pass for the situation', cues: ['Short and close: a soft, accurate pass.', 'Long or over someone: a higher, firmer pass.', 'A bounce pass is harder to intercept.', 'The best pass is the one your teammate can actually receive.'], common_error: 'Always using the same pass regardless of situation. Fix: set constraints requiring a named pass type per situation.' },
          { name: 'catching at different heights and speeds', cues: ['Thumbs together high, little fingers together low.', 'Move the feet to get behind the line of the object.', 'Watch it all the way in.', 'Give with the hands to absorb the pace.'], common_error: 'Snatching at the object rather than cushioning it. Fix: use a softer object and require a silent catch.' },
          { name: 'leading a moving receiver', cues: ['Throw to where they will be, not where they are.', 'Match the pass speed to their running speed.', 'Aim slightly ahead and to their open side.', 'Communicate before releasing.'], common_error: 'Throwing behind a runner, which stops them. Fix: mark a target zone ahead of the receiver and aim into it.' },
          { name: 'catching and sending in one motion', cues: ['Prepare the feet before the object arrives.', 'Absorb and redirect in one smooth movement.', 'Look for the next option before you receive.', 'Stay balanced throughout.'], common_error: 'Stopping dead after the catch, losing the advantage. Fix: require the next pass within two seconds in a cooperative drill.' },
          { name: 'throwing under light pressure', cues: ['Keep your head up to see options.', 'Protect the object with your body.', 'Move to create an angle rather than forcing it.', 'A calm, accurate pass beats a rushed, powerful one.'], common_error: 'Panicking and throwing it anywhere. Fix: allow a reset and a re-pass, and remove any penalty for pausing.' },
        ],
      },
      {
        title: 'Dribbling, Passing, and Foot Skills in Small-Sided Play',
        standards: [PE[1], PE[2], PE[4]],
        essentialQuestion: 'How do I keep and move an object as a team?',
        performanceTask: 'Play a small-sided cooperative game and explain two decisions you made about space and support.',
        adapted: A.foot, guardian: G.outdoorGames,
        topics: [
          { name: 'dribbling with control while travelling', cues: ['Small touches, ball within one step.', 'Use both feet.', 'Head up between touches.', 'Slow down to keep control in tight space.'], common_error: 'Head down throughout, missing teammates. Fix: hold up fingers at random and ask the dribbler to call the number.' },
          { name: 'passing to space rather than to a person', cues: ['Pass ahead of a moving teammate into the space they are running into.', 'Judge their speed before you release.', 'Call it so they know it is coming.', 'A pass to space only works if someone is moving there.'], common_error: 'Passing to a stationary teammate feet every time. Fix: award the cooperative goal only for passes received on the move.' },
          { name: 'passing and receiving with the feet', cues: ['Inside of the foot for accuracy.', 'Non-kicking foot beside the ball, pointing at the target.', 'Receive with a soft foot and cushion it.', 'First touch should set up the next action.'], common_error: 'A heavy first touch that gives the ball away. Fix: practise receiving into a marked small square.' },
          { name: 'shielding and changing direction', cues: ['Put your body between the ball and the opponent.', 'Keep the ball on the far foot.', 'Stay low and balanced.', 'Turn away from pressure, not into it.'], common_error: 'Turning into the defender. Fix: cue "check your shoulder before you turn".' },
          { name: 'supporting a teammate off the ball', cues: ['Move to an angle where a pass can actually reach you.', 'Do not stand behind an opponent.', 'Keep moving; a static option is easy to mark.', 'Communicate early and clearly.'], common_error: 'Everyone converging on the ball. Fix: set a minimum spacing rule between teammates.' },
          { name: 'small-sided cooperative play', cues: ['Fewer players means more touches for everyone.', 'Agree rules and boundaries before starting.', 'Rotate roles regularly.', 'Cooperate towards a shared target rather than a winner.'], common_error: 'One player dominating possession. Fix: require every player to touch the ball before the team target counts.' },
        ],
      },
      {
        title: 'Striking with Short and Long Implements',
        standards: [PE[1], PE[2]],
        essentialQuestion: 'How does the implement change the way I strike?',
        performanceTask: 'Rally cooperatively with two different implements and explain how grip, contact point, and follow-through changed between them.',
        adapted: A.strike, guardian: G.implements,
        topics: [
          { name: 'striking with a short-handled implement', cues: ['Shake-hands grip, firm wrist.', 'Ready position with the implement up and in front.', 'Turn side-on early.', 'Short, controlled swing.'], common_error: 'Waiting square-on and swinging late. Fix: require the turn as soon as the object is sent.' },
          { name: 'safe swing space with a long implement', cues: ['A long implement has a much larger swing radius.', 'Check all around before swinging, including behind.', 'Never swing near a person, a window, or a wall.', 'Put the implement down between turns rather than holding it loosely.'], common_error: 'Swinging while someone walks past. Fix: mark a swing zone that only one person enters at a time.' },
          { name: 'forehand and backhand contact', cues: ['Forehand: palm side leading.', 'Backhand: turn the shoulder further and lead with the knuckles.', 'Contact in front of the body for both.', 'Follow through towards the target.'], common_error: 'Running around the backhand to avoid it. Fix: set a rule that alternate shots must be backhand.' },
          { name: 'striking a stationary and a tossed object', cues: ['Stationary first, to groove the swing path.', 'For a tossed object, watch it all the way to contact.', 'Wait for it — do not lunge early.', 'Same contact point in front, in both cases.'], common_error: 'Lunging at a toss and mistiming it. Fix: use a slower, higher toss and cue "let it come".' },
          { name: 'directing a strike to a target area', cues: ['Aim by adjusting where the implement points at follow-through.', 'Contact slightly earlier or later to change direction.', 'Name the target before striking.', 'Control first, power second.'], common_error: 'Hitting hard with no target in mind. Fix: require the target to be called aloud before every strike.' },
          { name: 'cooperative and modified rallying', cues: ['Adjust rules to keep the rally going: allow a bounce, a bigger object, a shorter distance.', 'Aim to your partner strengths.', 'Talk during the rally.', 'The shared count is the goal.'], common_error: 'Increasing difficulty until the rally collapses. Fix: agree a modification the pair can sustain, then keep it.' },
        ],
      },
      {
        title: 'Rhythm, Dance, and Movement Composition',
        standards: [PE[1], PE[2], PE[5]],
        essentialQuestion: 'How do I compose movement that communicates something?',
        performanceTask: 'Compose a short movement sequence with a clear structure and explain its pattern and intent. Showing it beyond the facilitator is optional and is never done in front of an audience.',
        adapted: A.rhythm, guardian: G.rhythm,
        topics: [
          { name: 'beat, tempo, and phrasing', cues: ['A phrase is a group of counts, often eight.', 'Movements can start and finish with the phrase.', 'Tempo changes the feel without changing the steps.', 'Count aloud until the phrase is internalised.'], common_error: 'Movement drifting across phrase boundaries. Fix: require a held shape on count eight.' },
          { name: 'composing an original sequence', cues: ['Choose a structure first, such as ABA.', 'Contrast the sections in level, speed, or size.', 'Repetition makes a sequence readable.', 'Refine one element at a time.'], common_error: 'A string of unrelated moves. Fix: require a named structure and check each section against it.' },
          { name: 'learning a set movement pattern or folk dance', cues: ['Learn the footwork before adding arms or music.', 'Break it into short phrases.', 'Practise slowly, then to tempo.', 'Many folk dances carry cultural meaning worth knowing.'], common_error: 'Adding music too early, so errors are locked in. Fix: master the pattern in silence first.' },
          { name: 'repetition, contrast, and variation', cues: ['Repetition builds recognition.', 'Contrast keeps attention.', 'Variation changes one feature of a phrase while keeping the rest.', 'Too much change makes a sequence unreadable.'], common_error: 'Varying everything at once. Fix: change exactly one feature — level, speed, or direction — per repetition.' },
          { name: 'moving in time with a partner or group', cues: ['Agree a starting count.', 'Use peripheral vision rather than staring at others.', 'Match size and timing, not just the steps.', 'Someone gives a clear cue to start.'], common_error: 'Watching a neighbour and lagging behind. Fix: count in aloud together and keep an audible beat.' },
          { name: 'movement as expression and cultural practice', cues: ['Dance carries history, celebration, and story across cultures.', 'The same movement can mean different things in different traditions.', 'Learning a dance respectfully includes learning where it comes from.', 'Expression is personal, and there is no single correct interpretation.'], common_error: 'Treating a cultural dance as merely a set of steps. Fix: include a short, accurate note on origin and meaning.' },
        ],
      },
      {
        title: 'Health-Related Fitness and Personal Activity Planning',
        standards: [PE[3], PE[5]],
        essentialQuestion: 'How do I build an activity plan that fits my body and my life?',
        performanceTask: 'Build a two-week personal activity plan based on enjoyment, access, safety, and recovery. No weight, body measurement, calorie, timing, or fitness-test target may appear in it.',
        adapted: A.fitness, guardian: G.fitness,
        topics: [
          { name: 'components of health-related fitness', cues: ['Cardiorespiratory endurance, muscular strength, muscular endurance, flexibility, and body composition are the usual components.', 'Body composition is not assessed in this course and is not measured.', 'Different activities develop different components.', 'A varied plan covers more components than a single activity.'], common_error: 'Assuming one activity covers everything. Fix: map a favourite activity against the components and find the gaps.' },
          { name: 'judging effort without measurement', cues: ['Use the talk test rather than a number.', 'Notice breathing, warmth, and how the muscles feel.', 'Effort is personal and is not compared with anyone else.', 'Stop for dizziness, sharp pain, or breathlessness that will not settle, and tell an adult.'], common_error: 'Wanting a number to prove effort. Fix: use descriptive effort language and state plainly that no number is collected.' },
          { name: 'building cardiorespiratory endurance enjoyably', cues: ['Sustained rhythmic activity builds endurance.', 'Build up gradually over weeks.', 'Enjoyment predicts whether you continue.', 'Splitting activity across the day still counts.'], common_error: 'Starting too hard and stopping within a week. Fix: begin below what feels possible and build slowly.' },
          { name: 'muscular strength, endurance, and flexibility', cues: ['Body-weight movements are sufficient at this age.', 'Control the movement; stop when form breaks down.', 'Stretch when warm, to mild tension only.', 'Work opposing muscle groups, not just one.'], common_error: 'Chasing repetitions at the cost of form. Fix: define success as controlled movement and stop at the first form change.' },
          { name: 'warm-up, recovery, hydration, and sleep', cues: ['Warm up before and cool down after, every time.', 'Rest days let the body adapt.', 'Water before, during, and after.', 'Sleep is the most underrated part of any plan.'], common_error: 'Planning seven hard days with no recovery. Fix: require rest days to be written into the plan explicitly.' },
          { name: 'planning activity I will actually keep doing', cues: ['Start from what you enjoy, not what you think you should do.', 'Check it is realistic for time, cost, and transport.', 'Have a wet-weather and a low-energy alternative.', 'A plan that survives a missed day is a better plan.'], common_error: 'An ambitious plan that ignores real constraints. Fix: test the plan against a genuinely busy day and revise it.' },
        ],
      },
      {
        title: 'Strategy, Teamwork, Leadership, and Lifetime Activity',
        standards: [PE[2], PE[4], PE[5]],
        essentialQuestion: 'How do strategy, leadership, and inclusion make activity work for everyone?',
        performanceTask: 'Design an inclusive small-sided game, then lead or officiate it for an adult or a group and review what you would change for access and fairness. A learner may instead officiate a scripted scenario or write and justify the design.',
        adapted: A.game, guardian: G.outdoorGames,
        topics: [
          { name: 'offensive and defensive space', cues: ['Attacking: spread out to create space.', 'Defending: close space and stay between the attacker and the goal.', 'Space is created by movement, not by standing still.', 'Watch where the space is opening, not only where the object is.'], common_error: 'Everyone chasing the object. Fix: freeze play and ask each player to name the space they should be in.' },
          { name: 'inclusive design and lifetime activity options', cues: ['Design so ability differences do not exclude anyone.', 'Adjust equipment, space, and rules rather than the person.', 'Offer meaningful roles beyond playing.', 'Lifetime options include walking, cycling, swimming, dance, and climbing.'], common_error: 'Adding a rule that singles someone out. Fix: check the adaptation applies to everyone equally, and ask the player whether it works.' },
          { name: 'simple tactics and adjusting a plan', cues: ['A tactic is a plan for a situation.', 'Try it, watch what happens, then adjust.', 'Simple and understood beats clever and confusing.', 'Agree the tactic before play, not during.'], common_error: 'Sticking with a failing tactic. Fix: build in a review pause and permission to change it.' },
          { name: 'roles, rotation, and officiating', cues: ['Rotate so everyone experiences every role.', 'An official applies rules consistently and explains decisions.', 'Coaches observe and give one specific piece of feedback.', 'Every role is a real contribution.'], common_error: 'Treating officiating as a punishment. Fix: have the most confident players officiate first to signal its status.' },
          { name: 'leadership and encouraging feedback', cues: ['Give clear, short instructions and check they were understood.', 'Feedback names the action, not the person.', 'Notice effort and improvement, not only success.', 'Good leaders listen more than they talk.'], common_error: 'Feedback aimed at the person, such as "you are hopeless". Fix: require feedback in the form of one action plus one suggestion.' },
          { name: 'conflict resolution and repair', cues: ['Pause the game rather than arguing through it.', 'Each person describes what they saw.', 'Agree a fair restart.', 'Repair the relationship afterwards, not just the score.'], common_error: 'Carrying a grudge into the next game. Fix: close every dispute with an agreed restart and a brief check-in afterwards.' },
        ],
      },
    ],
  },
]
