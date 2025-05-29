import mongoose from 'mongoose';
import Category from './models/Category.js';

const categories = [
  // Programming Languages
  { name: 'JavaScript', description: 'A versatile scripting language primarily used for web development.' },
  { name: 'Python', description: 'A powerful, easy-to-learn programming language popular in many fields.' },
  { name: 'Java', description: 'A widely-used object-oriented programming language.' },
  { name: 'C++', description: 'A high-performance language used for system/software development and games.' },
  { name: 'C#', description: 'A modern, object-oriented language developed by Microsoft.' },
  { name: 'PHP', description: 'A popular server-side scripting language for web development.' },
  { name: 'Ruby', description: 'A dynamic, open source programming language with a focus on simplicity.' },
  { name: 'Swift', description: 'A powerful language for iOS and macOS app development.' },
  { name: 'Kotlin', description: 'A modern programming language for Android development.' },
  { name: 'Go', description: 'An open source programming language designed for simplicity and reliability.' },
  { name: 'Rust', description: 'A systems programming language focused on safety and performance.' },
  // Frameworks & Libraries
  { name: 'React', description: 'A JavaScript library for building user interfaces.' },
  { name: 'Angular', description: 'A TypeScript-based web application framework.' },
  { name: 'Vue.js', description: 'A progressive JavaScript framework for building user interfaces.' },
  { name: 'Node.js', description: 'A JavaScript runtime built on Chrome\'s V8 engine for server-side development.' },
  { name: 'Django', description: 'A high-level Python web framework.' },
  { name: 'Flask', description: 'A lightweight Python web framework.' },
  { name: 'Spring Boot', description: 'A framework for building Java-based web applications.' },
  { name: 'Laravel', description: 'A PHP framework for web artisans.' },
  { name: 'Express.js', description: 'A minimal and flexible Node.js web application framework.' },
  // Databases
  { name: 'MySQL', description: 'A popular open-source relational database management system.' },
  { name: 'PostgreSQL', description: 'A powerful, open source object-relational database system.' },
  { name: 'MongoDB', description: 'A document-oriented NoSQL database.' },
  { name: 'Redis', description: 'An in-memory key-value data store.' },
  { name: 'SQLite', description: 'A lightweight, disk-based database.' },
  { name: 'Oracle', description: 'A multi-model database management system produced by Oracle Corporation.' },
  { name: 'SQL Server', description: 'A relational database management system developed by Microsoft.' },
  // Development Tools
  { name: 'Git', description: 'A distributed version control system.' },
  { name: 'Docker', description: 'A platform for developing, shipping, and running applications in containers.' },
  { name: 'Kubernetes', description: 'An open-source system for automating deployment, scaling, and management of containerized applications.' },
  { name: 'Jenkins', description: 'An open-source automation server for CI/CD.' },
  { name: 'AWS', description: 'Amazon Web Services, a comprehensive cloud computing platform.' },
  { name: 'Azure', description: 'Microsoft\'s cloud computing platform.' },
  { name: 'Google Cloud', description: 'Google\'s suite of cloud computing services.' },
  // Mobile Development
  { name: 'Android', description: 'A mobile operating system developed by Google.' },
  { name: 'iOS', description: 'Apple\'s mobile operating system.' },
  { name: 'React Native', description: 'A framework for building native apps using React.' },
  { name: 'Flutter', description: 'A UI toolkit for building natively compiled applications from a single codebase.' },
  { name: 'Xamarin', description: 'A Microsoft framework for cross-platform mobile app development.' },
  // Web Development
  { name: 'HTML', description: 'The standard markup language for creating web pages.' },
  { name: 'CSS', description: 'A style sheet language used for describing the look of web pages.' },
  { name: 'SASS', description: 'A preprocessor scripting language that is interpreted or compiled into CSS.' },
  { name: 'Bootstrap', description: 'A popular CSS framework for developing responsive websites.' },
  { name: 'Tailwind CSS', description: 'A utility-first CSS framework for rapid UI development.' },
  { name: 'TypeScript', description: 'A strongly typed programming language that builds on JavaScript.' },
  { name: 'WebPack', description: 'A static module bundler for JavaScript applications.' },
  { name: 'REST API', description: 'An application programming interface that conforms to REST architectural style.' },
  { name: 'GraphQL', description: 'A query language for APIs and a runtime for executing those queries.' },
  // Testing
  { name: 'Unit Testing', description: 'Testing individual units or components of a software.' },
  { name: 'Integration Testing', description: 'Testing the integration of different software modules.' },
  { name: 'Jest', description: 'A delightful JavaScript testing framework.' },
  { name: 'Selenium', description: 'A suite of tools for automating web browsers.' },
  { name: 'Cypress', description: 'A JavaScript end-to-end testing framework.' },
  // Development Concepts
  { name: 'OOP', description: 'Object-Oriented Programming paradigm.' },
  { name: 'Design Patterns', description: 'Reusable solutions to common software design problems.' },
  { name: 'Data Structures', description: 'Ways to organize and store data efficiently.' },
  { name: 'Algorithms', description: 'Step-by-step procedures for calculations and data processing.' },
  { name: 'Clean Code', description: 'Code that is easy to understand and maintain.' },
  { name: 'Microservices', description: 'An architectural style that structures an application as a collection of small services.' },
  { name: 'DevOps', description: 'A set of practices that combines software development and IT operations.' },
  { name: 'Agile', description: 'An iterative approach to software development and project management.' },
  { name: 'TDD', description: 'Test-Driven Development, a software development process.' },
  { name: 'CI/CD', description: 'Continuous Integration and Continuous Deployment.' },
  // Security
  { name: 'Cybersecurity', description: 'The practice of protecting systems and networks from digital attacks.' },
  { name: 'Authentication', description: 'The process of verifying the identity of a user or system.' },
  { name: 'Authorization', description: 'The process of granting or denying access to resources.' },
  { name: 'OAuth', description: 'An open standard for access delegation.' },
  { name: 'JWT', description: 'JSON Web Token, a compact way to securely transmit information.' },
  // Level
  { name: 'Beginner', description: 'Suitable for those new to the subject.' },
  { name: 'Intermediate', description: 'For those with some prior knowledge or experience.' },
  { name: 'Advanced', description: 'For those with significant experience or expertise.' },
  // Course Type
  { name: 'Frontend', description: 'Development of the user interface and user experience.' },
  { name: 'Backend', description: 'Development of server-side logic and integration.' },
  { name: 'Full Stack', description: 'Development of both frontend and backend parts of an application.' },
  { name: 'Data Science', description: 'Field of study that uses scientific methods to extract knowledge from data.' },
  { name: 'Machine Learning', description: 'A subset of AI focused on building systems that learn from data.' },
  { name: 'AI', description: 'Artificial Intelligence, the simulation of human intelligence by machines.' },
  { name: 'Game Development', description: 'The art and science of creating video games.' },
  { name: 'Mobile Development', description: 'Building applications for mobile devices.' },
  { name: 'Desktop Development', description: 'Building applications for desktop operating systems.' }
];

async function seed() {
  await mongoose.connect('mongodb+srv://21110517:tankiet%402003@tankiet.nsmqp.mongodb.net/codechef?retryWrites=true&w=majority&appName=Tankiet', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  await Category.deleteMany({});
  await Category.insertMany(categories);

  console.log('Categories seeded!');
  mongoose.disconnect();
}

seed();
