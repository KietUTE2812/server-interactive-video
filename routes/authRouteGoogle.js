import express from "express";
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

const authRoute = express.Router();

passport.use(
    new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    }, (profile, done) => {
  
      // Check if google profile exist.
      if (profile.id) {
  
        User.findOne({ email: profile.emails[0].value })
          .then((existingUser) => {
            if (existingUser) {
              done(null, existingUser);
            } else {
              new User({
                googleId: profile.id,
                email: profile.emails[0].value,
                fullname: profile.name.familyName + ' ' + profile.name.givenName,
                username: profile.displayName,
                profile: {picture: profile.photos[0].value},
                role: 'student'
              })
                .save()
                .then(user => done(null, user));
            }
          })
      }
    })
  );
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser((id, done) => {
    User.findById(id)
      .then(user => {
        done(null, user);
      })
  });
authRoute.get(
    '/auth/google',
    passport.authenticate('google', {
      scope: ['profile', 'email']
    })
);
authRoute.get('/auth/google/callback', // add **/auth**
    (req,res,next)=>{
      passport.authenticate('google', { failureRedirect: '/auth/google/error' }, async (error, user , info) => {
        if (error){
          return res.send({ message:error.message });
        }
        if (user){
          try {
            // your success code
            return res.send({
              data: result.data,
              message:'Login Successful' 
            });
          } catch (error) {
            // error msg 
            return res.send({ message: error.message });
          }
        }
      })(req,res,next);
    }); 

export default authRoute;   