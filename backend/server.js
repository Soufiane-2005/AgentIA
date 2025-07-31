const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors')

// Load environment variables
dotenv.config();
const app = express();
app.use(bodyParser.json());
app.use(cors())

const studentProfiles = {};
const assessmentHistory = [];

// Configure Gemini API
const genAI = new GoogleGenerativeAI(process.env.api_key);

// Models
class QuizQuestion {
    constructor(question, options, correct_answer, difficulty) {
        this.question = question;
        this.options = options;
        this.correct_answer = correct_answer;
        this.difficulty = difficulty;
    }
}




// Helper functions
async function generateAssessmentQuiz(course, num_questions = 8) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
        Generate a quiz with ${num_questions} multiple-choice questions for the course '${course}'. 
        Each question should have:
        - A question text relevant to ${course}.
        - 4 answer options (labeled as strings).
        - The index (0-3) of the correct answer.
        - A difficulty level ('beginner', 'intermediate', or 'advanced').
        Return the response as a JSON array of objects, each with keys: 'question', 'options', 'correct_answer', 'difficulty'.
        Ensure questions are accurate, relevant to ${course}, and varied in difficulty.
        Example format:
        [
            {
                "question": "What does SELECT * FROM table_name do in SQL?",
                "options": ["Deletes all rows", "Selects all columns", "Updates all rows", "Creates a table"],
                "correct_answer": 1,
                "difficulty": "beginner"
            }
        ]
            en plus les questions doivent etre en francais.!!!
        `;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let responseText = response.text().trim();
        
        if (responseText.startsWith("```json")) {
            responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        }
        
        const quizData = JSON.parse(responseText);
        return quizData.map(q => new QuizQuestion(q.question, q.options, q.correct_answer, q.difficulty));
    } catch (e) {
        throw new Error(`Failed to generate quiz for ${course}: ${e.message}`);
    }
}

async function evaluateAssessmentQuiz(course, answers, questions, nom) {
    if (answers.length !== questions.length) {
        throw new Error("Number of answers does not match number of questions");
    }

    console.log(questions.map((q, i) => ({
            question: q.question,
            options: q.options,
            correct_answer: q.correct_answer,
            student_answer: answers[i]
        })))

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
                    You are an exact quiz evaluator.

                    Evaluate the student's answers for the '${course}' quiz.

                    Compare each student answer with the correct answer **strictly** (case-sensitive if needed).
                    Quiz Data:
                    ${JSON.stringify(questions.map((q, i) => ({
                        question: q.question,
                        options: q.options,
                        correct_answer: q.correct_answer,
                        student_answer: answers[i]
                    })), null, 2)}
                    ;

                    Then:
                    1. Count how many answers are correct.
                    2. Calculate the exact score as a percentage with 2 decimal places.
                    3. Assign a level:
                    - <50% => "beginner"
                    - 50-79% => "intermediate"
                    - >=80% => "advanced"

                    Return the result in this **exact JSON** format:
                    {
                    "score": float,     // for example: 75.00, mais s'il vous plait il faut vraiment exacte ne faite des erreurs.
                    "level": string,    // beginner, intermediate, or advanced
                    "detailed_analysis": string,
                    "recommendations": string[]
                    "Repartition" : objet // for exemple: {debutant: 42%, Intermediaire: 24%, Avance: 32% }
                    }

                    note bien: 

                    tout devra etre en francais : level detailed recommendations.
                    il est essentiel que le score doit bien etre calculer sans erreur je dis sans erreur.
                    le niveau aussi doit etre bien determiner.
                    il faut addresse a moi (je m'appel ${nom}) lorsque vous faites l'analyse. (ne dit pas bonjour fair l'analyse directement)

                    
                    `;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let responseText = response.text().trim();
        
        if (responseText.startsWith("```json")) {
            responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        }
        console.log(JSON.parse(responseText).score)
        
        return JSON.parse(responseText);
    } catch (e) {
        throw new Error(`Failed to evaluate quiz for ${course}: ${e.message}`);
    }
}

async function generateLearningStyleQuestionnaire(num_questions = 12) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
        Generate a questionnaire with ${num_questions} questions to assess a student's learning style (visual, auditory, kinesthetic, reading/writing).
        Each question should:
        - Ask about learning preferences (e.g., "How do you prefer to learn new material?").
        - Have 4 answer options, each corresponding to one learning style (visual, auditory, kinesthetic, reading/writing, in that order).
        - Include a 'correct_answer' field (set to 0, used for scoring).
        - Set difficulty to 'general'.
        Return the response as a JSON array of objects, each with keys: 'question', 'options', 'correct_answer', 'difficulty'.
        Example format:
        [
            {
                "question": "How do you best learn new material?",
                "options": ["Watching videos or diagrams", "Listening to explanations", "Hands-on practice", "Reading texts"],
                "correct_answer": 0,
                "difficulty": "general"
            }
        ]
            en plus les questions doivent etre en francais.!!!
            la difficulty aussi en francais .

        `;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let responseText = response.text().trim();
        
        if (responseText.startsWith("```json")) {
            responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        }
        
        const quizData = JSON.parse(responseText);
        return quizData.map(q => new QuizQuestion(q.question, q.options, q.correct_answer, q.difficulty));
    } catch (e) {
        throw new Error(`Failed to generate learning style questionnaire: ${e.message}`);
    }
}
async function evaluateLearningStyle(answers, questions, nom) {
    if (answers.length !== questions.length) {
        throw new Error("Number of answers does not match number of questions");
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const prompt = `
        Evaluate the following learning style questionnaire responses to determine the student's primary learning style (visual, auditory, kinesthetic, reading/writing).
        Responses (option indices 0-3 correspond to visual, auditory, kinesthetic, reading/writing):
        Answers: ${JSON.stringify(answers)}
        Questions: ${JSON.stringify(questions.map(q => ({
            question: q.question,
            options: q.options
        })), null, 2)}

        Count the frequency of each learning style based on selected options.
        Identify the dominant learning style (highest count).
        Return only a JSON object with:
        - learning_style: string (visual, auditory, kinesthetic, reading/writing)
        - detailed_analysis: string (distribution of responses)
        - recommendations: list of strings (learning suggestions)

        Format:
        {
            "learning_style": "visual",
            "detailed_analysis": string // c'est comme un courte texte pour analyser les reponses
            "recommendations": ["Use diagrams and videos.", "Ceate mind maps."]
            "Repartition" : objet // for exemple : { visual: 43 , auditory: 10 ..... } 43 et 13 et les valeurs de toutes les styles sont en % mais ne l'ecrite pas la somme doit etre 100
        }

            note bien: 

            tout devras en francais; learning style detailed anaylisis et recommendation
            le pourcentage doit etre bien calculer (sans erreur) et aussi la meme chose pour learning_style 
            il faut addresse a moi (je m'appel ${nom}) lorsque vous faites l'analyse.
            la somme de repertition doit egale a 100 (obligatoire)
            
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let responseText = response.text().trim();

        // 🧹 Sanitize Gemini response
        responseText = responseText
            .replace(/```[\w]*\n?/g, '') // retire ```json ou autres
            .replace(/```/g, '')
            .trim();

        // 🧠 Extraire uniquement le JSON entre { ... }
        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.lastIndexOf('}') + 1;
        const jsonString = responseText.slice(jsonStart, jsonEnd);

        return JSON.parse(jsonString);
    } catch (e) {
        throw new Error(`Failed to evaluate learning style: ${e.message}`);
    }
}


// API Endpoint
app.post('/profiling', async (req, res) => {
    try {
        const now = new Date().toISOString();
        const cours = req.body.cours
        const quiz_answers =    req.body.quiz_answers
        const learning_style_answers =    req.body.learning_style_answers
        const quizQuestions =    req.body.quizQuestions
        const lsQuestions =   req.body.lsQuestions
        const nom = req.body.nom
        

      

       

        
        
        const quizQuestionsDict = quizQuestions.map(q => ({
            question: q.question,
            options: q.options,
            correct_answer: q.correct_answer,
            difficulty: q.difficulty
        }));
        
       
        const lsQuestionsDict = lsQuestions.map(q => ({
            question: q.question,
            options: q.options,
            correct_answer: q.correct_answer,
            difficulty: q.difficulty
        }));

      

       

        // Evaluate answers
        const quizAssessment = await evaluateAssessmentQuiz(cours, quiz_answers, quizQuestionsDict, nom);
        const lsAssessment = await evaluateLearningStyle(learning_style_answers, lsQuestionsDict, nom);

        

        return res.status(200).json({
            level: quizAssessment.level,
            score: quizAssessment.score,
            learning_style: lsAssessment.learning_style,
            assessment_date: now,
            quiz_detailed_analysis: quizAssessment.detailed_analysis,
            quiz_recommendations: quizAssessment.recommendations,
            quiz_Repartitions: quizAssessment.Repartition,
            ls_detailed_analysis: lsAssessment.detailed_analysis,
            ls_recommendations: lsAssessment.recommendations,
            ls_Repartition: lsAssessment.Repartition





        })

        
        

    } catch (e) {
        console.error(`Error processing profiling for course ${req.body?.cours}:`, e);
        return res.status(500).json({
            error: `Error processing profiling for course ${req.body?.cours}: ${e.message}`
        });
    }
});



app.get('/profiling/:cours', async (req,res)=>{
    const cours = req.params.cours;
    
    // Generate quiz and learning style questions
        const quizQuestions = await generateAssessmentQuiz(cours, 8);
        const quizQuestionsDict = quizQuestions.map(q => ({
            question: q.question,
            options: q.options,
            correct_answer: q.correct_answer,
            difficulty: q.difficulty
        }));
        
        const lsQuestions = await generateLearningStyleQuestionnaire(12);
        const lsQuestionsDict = lsQuestions.map(q => ({
            question: q.question,
            options: q.options,
            correct_answer: q.correct_answer,
            difficulty: q.difficulty
        }));

        return res.status(200).json({quizQuestions: quizQuestions, lsQuestions: lsQuestions})


})

const multer = require('multer')
const fs = require('fs');
const pdfParse = require('pdf-parse')
const axios = require('axios')

const uploads = multer({
    dest: './uploads',
    limits: { fileSize: 100 * 1024 * 1024 }  // Limite à 10MB
})

async function generateQuiz(text, nbr){
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
        
            Génère un quiz de ${nbr} questions basé sur le texte (c'est en fait un pdf que j'ai transforme en texte) suivant. Format requis :
            - il faut poser les questions seulement sur le cours elle meme qui est traite par le pdf (texte)
            - Chaque question doit avoir 4 options.
            - La réponse correcte doit être l'index de l'option (0 à 3).
            - Retourne uniquement un JSON valide comme ceci :

            [
            {
                "question": "Question texte ici?",
                "options": ["Option1", "Option2", "Option3", "Option4"],
                "correct_answer": 0
            }
            ]

            Texte à utiliser : ${text}

            Important :
            1. Ne retourne que le JSON, sans commentaires.
            2. Les questions doivent couvrir les points clés du texte.

        `;
        
        const result = await model.generateContent(prompt);

        const response = await result.response;
        let responseText = response.text().trim();


        if (responseText.startsWith("```json")) {
            responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        }
        
        const quizData = JSON.parse(responseText);
        return quizData.map(q => new QuizQuestion(q.question, q.options, q.correct_answer));
        
        
    } catch (e) {
        throw new Error(`Failed to generate quiz : ${e.message}`);
    }

}


function convertGoogleDriveUrl(url) {
    const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)\//);
    if (!match) throw new Error("Lien Google Drive invalide.");
    const fileId = match[1];
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

app.post('/quiz', async (req,res)=>{
    console.log('hello')
    console.log(req)
    console.log('soufiane')
    const {pdfUrl, questionCount} = req.body;
    


     if (!pdfUrl) {
            return res.status(400).json({ error: "pdfUrl manquant dans le corps de la requête" });
        }
    
    const downloadUrl = convertGoogleDriveUrl(pdfUrl);
    const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
    const dataBuffer = Buffer.from(response.data, 'binary');
    const pdfText = await pdfParse(dataBuffer);

    
    

    

    const quiz = await generateQuiz(pdfText.text, questionCount)

   

    return res.json({ quiz });
})



const PORT = process.env.port
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});