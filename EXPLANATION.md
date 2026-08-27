# What is PersonaLab AI? (Simple Explanation)

## What are we doing?
We are building a tool called **PersonaLab AI**. Imagine you have a new product idea, but you don't want to spend weeks finding real people to test it. PersonaLab lets you create "fake" (synthetic) people based on real data you already have (like customer quotes or market research). 

You give the app your product idea and data, and it creates a "panel" of these AI personas. These personas then "react" to your product, telling you if they would buy it, if they understand it, and what their biggest complaints are. It's a quick way to test ideas before spending real money.

## What are we using?
We are building this as a modern web application using:
- **Next.js & React**: The core framework for building the website.
- **TypeScript**: A programming language that ensures our code is strict and error-free.
- **CSS**: For making the application look premium, dark-themed, and modern.
- **Zod**: A tool that makes sure the AI gives us answers in the exact format we need (like getting a number for a score instead of a paragraph of text).
- **Groq (AI)**: The fast AI engine that powers the "fake" people. (We also have a built-in fake engine so the app works even without an internet connection or API keys).

## How are we doing it?
1. **Intake**: You type in your product details and paste any customer quotes you have.
2. **AI Generation**: The app sends this to the AI, which generates realistic "personas" (target customers) based strictly on your quotes.
3. **Simulation**: The app asks each persona individually what they think of your product.
4. **Reporting**: The app gathers all their answers, finds the most common complaints, calculates a "Purchase Intent" score, and gives you a visual report with recommendations on what to fix.
