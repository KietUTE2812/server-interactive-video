import mongoose from 'mongoose';
import {Video, ModuleItem} from './models/Module.js';
import  Course  from './models/Course.js';

async function connect() {
  await mongoose.connect('mongodb+srv://21110517:tankiet%402003@tankiet.nsmqp.mongodb.net/codechef?retryWrites=true&w=majority&appName=Tankiet', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
}

async function close() {
  await mongoose.connection.close();
}

// async function seed() {
//   await connect();
//   const video = await Video.find({file : {$regex : "http://40."}});
//   console.log(video);
//   for (const v of video) {
//     v.file = v.file.replace("40.81.24.159", "34.133.23.75");
//     await v.save();
//   }
//   await close();
// }
// seed();

// async function seed() {
//   await connect();
//   const moduleItem = await ModuleItem.find({ type: "supplement" , reading : {$regex : "http://40."}});
//   console.log(moduleItem);
//   for (const v of moduleItem) {
//     v.reading = v.reading.replace("40.81.24.159", "34.133.23.75");
//     await v.save();
//   }
//   await close();
// }

async function seed() {
  await connect();
  const course = await Course.find({tags : {$regex : "," , $options : "i"}}); // tìm kiếm tất cả các khóa học có chứa dấu phẩy
  course.forEach(async (course) => {
    console.log(course.title);
    console.log(course.tags);
    course.tags = course.tags[0].split(",");
    await course.save();
  });
}
seed();

