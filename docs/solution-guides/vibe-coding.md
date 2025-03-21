# 15 Rules of Vibe Coding I've Learned

*By Kathy Alleman*  
*Published in Towards AGI*  
*5 min read · Feb 14, 2025*

Vibe coding is more than a methodology — it's a mindset that prioritizes fluidity, creativity, and joy in software development. By blending modern tools with intentional workflows, developers can sidestep burnout and produce high-quality work efficiently. Below is an expanded guide to these principles, designed to help you build faster, smarter, and with more enthusiasm.

## 1. Start from a Template: Accelerate Your Foundation

> "Why reinvent the wheel when you can customize a Ferrari?"

Begin every project by cloning a pre-built template. Platforms like GitHub and StackBlitz offer battle-tested starters for frameworks like Next.js, React, or Svelte. For instance, the Next.js AI Template provides authentication, database hooks, and AI integration out of the box.

### Key Practices:
- **Modular Customization**: Replace placeholder content (e.g., logos, color schemes) before diving into complex features
- **Template Audits**: Review the template's dependencies and structure to avoid bloat. Delete unused components (e.g., remove Firebase logic if using Supabase)
- **Credits and Licenses**: Always verify the template's license terms, especially for commercial projects

## 2. Activate Agent Mode: Command Your IDE with Language

> "Your IDE is a co-pilot, not just a text editor."

Tools like Cursor's agent mode transform natural language prompts into actionable code. For example:

"Generate a Next.js API route that fetches user data from PostgreSQL using Prisma, with error handling."

The agent drafts the skeleton code, which you can refine. This approach minimizes syntax struggles and keeps you in a creative flow.

### Pro Tips:
- **Specificity Wins**: Include details like library preferences (e.g., "Use Axios instead of fetch")
- **Chain Prompts**: Break complex tasks into smaller steps. First, create a component, then add props, and finally implement styling

## 3. Harness Perplexity for Dynamic Research

"Let AI scour the web so you don't have to."

When integrating new features, use Perplexity to source tutorials, APIs, and design patterns. For a real-time chat feature:

"Best practices for implementing WebSocket in Next.js 14 with rate limiting and Redis caching."

Perplexity will return curated resources, code snippets, and even warnings about deprecated libraries.

Workflow Integration:

Comparative Analysis: Ask for pros/cons between tools (e.g., "Socket.io vs. Pusher for real-time apps").
Troubleshooting: Paste error snippets into Perplexity with context for tailored solutions.

## 4. Compartmentalize Composer Chats: Isolate to Focus

"Multitasking is the enemy of flow."

Create separate Composer chats for distinct tasks to maintain mental clarity:

Authentication Chat: "Debug JWT token refresh issues in Next-Auth."
UI/UX Chat: "Optimize mobile responsiveness for the dashboard grid."
This prevents context-switching and ensures solutions stay organized. Save frequent chats as templates (e.g., "API Error Debugging") for future reuse.

## 5. Run Locally, Test Frequently: Fail Fast, Fix Faster

"A minute of testing saves hours of debugging."

Leverage local development servers (e.g., next dev) for instant feedback. Pair this with:

Hot Reloading: See CSS changes in real time.
API Simulation: Mock endpoints with tools like MirageJS before backend completion.
Error Tracking: Integrate Sentry or LogRocket locally to catch exceptions early.
Testing Checklist:

Cross-browser checks (Chrome, Firefox, Safari).
Network throttling tests for slow connections.
Validation of environment variables in both dev and prod modes.

## 6. Iterate Designs Fearlessly: Ugly First, Polished Later

"Perfect is the enemy of shipped."

Adopt a three-phase design process:

Functional Prototype: Bare-bones UI with core features (e.g., a button that submits data).
User Testing: Gather feedback on workflow and pain points.
Aesthetic Refinement: Add animations, typography, and micro-interactions.
For example, build a basic admin panel with placeholder data tables first, then integrate sorting/filtering, and finally apply framer-motion for smooth transitions.

## 7. Speak Your Code: Voice-to-Text for Speed

"Your voice is your fastest keyboard shortcut."

Tools like Whispr Flow or GitHub Copilot Voice convert speech to code:

"Create a Python function that takes a list of integers and returns the sum of even numbers. Use list comprehension."

This is particularly useful for:

Drafting documentation.
Generating repetitive code (e.g., DTO classes, CRUD operations).
Brainstorming pseudocode aloud.

## 8. Clone Strategically, Fork Boldly: Build on Giants

"Standing on shoulders beats starting from toes."

Use GitHub's "Explore" tab to find repos matching your vision. For a SaaS boilerplate:

Fork a repo like nextjs-saas-starter.
Customize Core Logic: Swap Stripe for Paddle as the payment processor.
Theming: Implement a CSS-in-JS solution (e.g., Styled Components) to overhaul the design.
Extend Features: Add a CMS integration like Payload or Sanity.
Always audit for outdated dependencies and security vulnerabilities post-fork.

## 9. Debug with Composer: Paste Errors, Get Solutions

"Errors are puzzles, not roadblocks."

When encountering a 500 Internal Server Error, paste the full error and relevant code into Composer:

"My Next.js API route returns a 500 error when fetching user data. Here's the Prisma query: [snippet]. The PostgreSQL log shows a timeout."

The agent might suggest:

Adding database indexes.
Increasing connection timeouts.
Fixing async/await mismatches.
Pro Tip: Include environment details (Node.js version, OS) for more accurate fixes.

## 10. Time-Travel with Chat History: Rewind to Success

"Mistakes are reversible; progress is retrievable."

If a refactor breaks your app, revisit prior Composer chats where features worked. For example:

"Restore the authentication workflow from yesterday's chat before I added OAuth."

Archive successful prompts in a playbook.md file for future reference.

## 11. Guard Secrets Like a Vault: Never Hardcode

"Exposed keys are existential risks."

Store credentials in .env files and load them via process.env:

NEXT_PUBLIC_SUPABASE_URL=your_url_here

Security Practices:

Use git-secrets to scan for accidental commits of keys.
Rotate keys quarterly or after team member departures.
Employ vaults like AWS Secrets Manager for production.

## 12. Commit Often: Atomic Saves for Safety

"Small commits are time machines."

Use Cursor's agent to automate Git workflows:

"Commit changes in components/Button with message 'feat: add loading state prop' and push to branch feature/auth."

Branch Strategy:

main: Stable, deployable code.
dev: Integration branch for features.
feature/*: Short-lived branches for specific tasks.

## 13. Deploy Early: Validate in the Wild

"Production is the ultimate test environment."

Use platforms like Vercel or Netlify for instant deployments:

Catch Platform-Specific Bugs: Serverless function cold starts, file size limits.
Monitor Performance: Use Lighthouse CI for automated audits on every deploy.
Share Previews: Send stakeholders a vercel.app URL for feedback.
Deployment Checklist:

Minify assets.
Configure caching headers.
Enable HTTPS and HSTS.

## 14. Curate a Prompt Library: Reuse Genius

"Your best prompts are golden tickets."

Maintain a prompts.md with categorized examples:

### API Development  
"Generate a TypeScript interface for a User model with fields: id, email, createdAt."  
### Debugging  
"Explain why my React useEffect hook runs twice in Strict Mode."
Share this library with your team to onboard new developers faster.

## 15. Code with Joy: Embrace the Vibe

"The best code is written with a smile."

Celebrate Small Wins: Fixed a tricky bug? Dance it out.
Gamify Progress: Use tools like WakaTime to track streaks.
Creative Side Quests: Build a fun Easter egg (e.g., a terminal-style about page).
Remember, vibe coding isn't about perfection — it's about enjoying the journey of creation.

Final Thoughts
These rules are a framework, not a cage. Adapt them to your style, experiment with new tools, and prioritize what keeps you in the flow. The goal isn't just to ship code — it's to cultivate a sustainable, joyful practice that fuels lifelong learning. Now go forth, vibe hard, and build something amazing.