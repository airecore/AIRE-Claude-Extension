import type { ButtonType } from './types'

// The tool library people pick from when they add a tool. Today it is one
// bundled source (AIRE). Later it is served by the backend with more
// sources: AIRE first, then the person's own organisation, managed by its
// admins (see docs/backlog.md, "Organisation library").

export interface LibraryItem {
  /** Stable id, so analytics can count adds per item later. */
  id: string
  name: string
  /** One line that says what the tool does, in the user's words. */
  description: string
  type: ButtonType
  /** The text typed into the chat box. [Square brackets] mark the parts
   * the person fills in before sending. */
  prompt: string
  /** Set when the item only works with one assistant. */
  assistant?: 'claude'
}

export interface LibrarySection {
  id: string
  title: string
  /** Optional note shown under the section title. */
  note?: string
  items: LibraryItem[]
}

export interface LibrarySource {
  id: string
  /** Who provides these tools, shown as the library's heading. */
  name: string
  sections: LibrarySection[]
}

const writing: LibrarySection = {
  id: 'writing',
  title: 'Writing',
  items: [
    {
      id: 'aire-plain-english',
      name: 'Rewrite in plain English',
      description: 'Makes dense or technical text easy for anyone to read.',
      type: 'prompt',
      prompt: `Rewrite the text below in plain English for a reader with no background in the topic.

Rules:
- Short sentences, everyday words, active voice.
- Keep every fact. Do not add new ones.
- Explain any term you cannot replace.

Text:
[paste text here]`,
    },
    {
      id: 'aire-professional-email',
      name: 'Draft a professional email',
      description: 'Turns a few rough points into a clear, polite email.',
      type: 'prompt',
      prompt: `Write an email for me.

To: [who it is for, and how well I know them]
Purpose: [what I want them to know or do]
Key points:
- [point 1]
- [point 2]
Tone: [friendly / formal / firm]

Keep it under 150 words, with a clear subject line and one clear request at the end.`,
    },
    {
      id: 'aire-proofread',
      name: 'Proofread and tighten',
      description: 'Fixes errors and cuts padding without changing your voice.',
      type: 'prompt',
      prompt: `Proofread the text below. Fix spelling, grammar and punctuation, and cut words that add nothing. Keep my voice and meaning. Use Australian English.

Give me the corrected text first, then a short list of the main changes.

Text:
[paste text here]`,
    },
  ],
}

const thinking: LibrarySection = {
  id: 'thinking',
  title: 'Thinking and deciding',
  items: [
    {
      id: 'aire-exec-summary',
      name: 'Summarise for a busy executive',
      description: 'The key message, the numbers and the decision needed, in under a minute.',
      type: 'prompt',
      prompt: `Summarise the material below for a senior executive with two minutes to spare.

Format:
1. The bottom line, in one sentence.
2. Three to five key points, with numbers where they exist.
3. The decision or action needed from them, if any.

Material:
[paste document or notes here]`,
    },
    {
      id: 'aire-explain-new',
      name: 'Explain it like I am new to this',
      description: 'A patient explanation with an example and the words to know.',
      type: 'prompt',
      prompt: `Explain [topic] to me as if I am new to it.

Start with a one-sentence summary. Then explain how it works using a simple real-world example. End with the five terms I should know, each with a one-line definition. Check at the end whether I want to go deeper on any part.`,
    },
    {
      id: 'aire-options-recommend',
      name: 'Compare options and recommend',
      description: 'Lays out pros, cons and risks, then picks one with reasons.',
      type: 'prompt',
      prompt: `Help me decide between these options:
- [option A]
- [option B]
- [option C]

Context: [goal, budget, deadline, what matters most]

Give me a table of pros, cons and risks for each option. Then recommend one, explain why in three sentences, and say what would change your recommendation.`,
    },
    {
      id: 'aire-devils-advocate',
      name: 'Challenge my thinking',
      description: 'Finds the weak spots in a plan or argument before others do.',
      type: 'prompt',
      prompt: `Act as a sceptical but fair reviewer. Here is my plan or argument:

[paste plan or argument here]

List the five strongest objections someone could raise, from most to least serious. For each one, suggest how I could address it. Do not soften the feedback.`,
    },
  ],
}

const meetings: LibrarySection = {
  id: 'meetings',
  title: 'Meetings and planning',
  items: [
    {
      id: 'aire-meeting-minutes',
      name: 'Notes to minutes and actions',
      description: 'Turns messy meeting notes into decisions and a task list.',
      type: 'prompt',
      prompt: `Turn these meeting notes into minutes.

Sections:
- Decisions made
- Action items, as a table: task, owner, due date (write "not set" if unknown)
- Open questions

Do not invent owners or dates.

Notes:
[paste notes or transcript here]`,
    },
    {
      id: 'aire-meeting-prep',
      name: 'Prepare for a meeting',
      description: 'An agenda, likely questions and the outcome to aim for.',
      type: 'prompt',
      prompt: `I have a meeting coming up.

With: [who, and their role]
About: [topic]
What I want from it: [outcome]
Time: [length]

Write a short agenda with times, the five questions they are most likely to ask me with suggested answers, and one sentence I can open with.`,
    },
    {
      id: 'aire-action-plan',
      name: 'Turn a goal into an action plan',
      description: 'Breaks a goal into steps with owners, timing and risks.',
      type: 'prompt',
      prompt: `Turn this goal into a practical action plan.

Goal: [what I want to achieve]
Deadline: [date]
People and resources: [who and what I have]

Give me the steps in order, each with an owner, a target date and how we know it is done. Then list the three biggest risks and how to reduce each.`,
    },
  ],
}

const prompting: LibrarySection = {
  id: 'prompting',
  title: 'Better prompts',
  items: [
    {
      id: 'aire-prompt-coach',
      name: 'Build a better prompt',
      description: 'Interviews you, then writes a structured prompt you can reuse.',
      type: 'prompt',
      prompt: `I want to write a good prompt for this task: [describe the task].

Ask me up to five short questions, one at a time, about the context, audience, format and quality bar. Then write a structured prompt with these parts: role, context, task, constraints, output format and an example. Keep it reusable by marking the parts that change in [square brackets].`,
    },
    {
      id: 'aire-brainstorm',
      name: 'Brainstorm ideas',
      description: 'Ten varied ideas, then the best three developed further.',
      type: 'prompt',
      prompt: `Brainstorm ideas for: [challenge or question]

Context: [audience, budget, limits]

Give me ten ideas that are clearly different from each other, from safe to bold. Then pick the three with the best balance of impact and effort, and give each a short plan to test it within two weeks.`,
    },
  ],
}

const claudeSkills: LibrarySection = {
  id: 'claude-skills',
  title: 'Claude skills: make files',
  note: 'These use Claude’s built-in file skills. In Claude, turn on Settings › Capabilities › Code execution and file creation.',
  items: [
    {
      id: 'aire-claude-word',
      name: 'Create a Word document',
      description: 'A formatted .docx you can download and edit.',
      type: 'prompt',
      assistant: 'claude',
      prompt: `Use your Word (docx) skill to create a document.

Document: [report / proposal / policy / letter]
Audience: [who will read it]
Content: [paste notes or describe what it must cover]

Use clear headings, a short summary at the top and a professional layout. Give me the .docx file to download.`,
    },
    {
      id: 'aire-claude-excel',
      name: 'Build an Excel spreadsheet',
      description: 'A working .xlsx with formulas, not just a table.',
      type: 'prompt',
      assistant: 'claude',
      prompt: `Use your Excel (xlsx) skill to build a spreadsheet.

Purpose: [budget / tracker / calculator / report]
Columns or inputs: [list them]
Calculations: [totals, formulas, what-if inputs]

Use real formulas, not typed values, so it updates when I change inputs. Format it clearly and give me the .xlsx file to download.`,
    },
    {
      id: 'aire-claude-powerpoint',
      name: 'Make a PowerPoint deck',
      description: 'A short .pptx deck from your notes.',
      type: 'prompt',
      assistant: 'claude',
      prompt: `Use your PowerPoint (pptx) skill to create a slide deck.

Topic: [topic]
Audience: [who, and what they care about]
Length: [number of slides]
Content: [paste notes or key messages]

One idea per slide, short headlines that state the point, and speaker notes for each slide. Give me the .pptx file to download.`,
    },
    {
      id: 'aire-claude-pdf',
      name: 'Work with a PDF',
      description: 'Pulls tables or key facts out of a PDF you attach.',
      type: 'prompt',
      assistant: 'claude',
      prompt: `Use your PDF skill on the PDF I have attached.

[Choose one, delete the others]
- Extract every table into a spreadsheet I can download.
- List the key dates, amounts, names and obligations.
- Summarise each section in two sentences.`,
    },
    {
      id: 'aire-claude-skill-creator',
      name: 'Turn this into a reusable skill',
      description: 'Packages a task you repeat as a Claude skill.',
      type: 'prompt',
      assistant: 'claude',
      prompt: `Use your skill-creator skill to help me build a new skill.

The task I repeat: [describe it]
Good output looks like: [describe or paste an example]

Ask me what you need to know, then create the skill and explain how to add it to Claude.`,
    },
  ],
}

export const AIRE_LIBRARY: LibrarySource = {
  id: 'aire',
  name: 'AIRE library',
  sections: [writing, thinking, meetings, prompting, claudeSkills],
}
