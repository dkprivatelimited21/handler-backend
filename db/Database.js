const mongoose = require("mongoose");
const DB_URL = 'mongodb+srv://everythingfree4200:anshsharma%4021@cluster0.1ivdd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'
const connectDatabase = () => {
  mongoose
    .connect(process.env.DB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then((data) => {
      console.log(`mongod connected with server: ${data.connection.host}`);
    });
};

module.exports = connectDatabase;
