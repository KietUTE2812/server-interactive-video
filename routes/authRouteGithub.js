import express from 'express';
import passport from 'passport';
import User from '../models/User.js';
import { Strategy as GithubStrategy } from 'passport-github';
const authRoute = express.Router();
import session from 'express-session';

passport.use(
    new GithubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL
        }, (accessToken, refreshToken, profile, done) => {
            
        // Check if github profile exist.
        if (profile.id) {
    
            User.findOne({ email: profile.emails[0].value })
            .then((existingUser) => {
                if (existingUser) {
                    const newUser = {
                        githubId: profile.id,
                        fullname: profile.displayName,
                        username: profile.username,
                        profile: {picture: profile.photos[0].value},
                        role: 'student'
                    }
                    User.updateOne({ email: profile.emails[0].value }, newUser)
                        .then(() => {
                            User.findOne({ email: profile.emails[0].value }) // Lấy lại user sau khi update
                            .then(user => done(null, user)); // Trả về đối tượng user đầy đủ
                        });
                    
                } else {
                const newUser = new User({
                    githubId: profile.id,
                    userId: profile.id,
                    email: profile.emails[0].value,
                    fullname: profile.displayName,
                    username: profile.username,
                    profile: {picture: profile.photos[0].value},
                    role: 'student'
                });
                User.create(newUser).then(user => done(null, user));
                }
            })
        }
        })
    );
    passport.serializeUser((user, done) => {
    done(null, user.userId);
    });
    passport.deserializeUser((id, done) => {
        User.findById({userId: id})
            .then(user => {
            done(null, user);
            })
        }
);

authRoute.use(session({
    secret: process.env.COOKIE_KEY,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));
authRoute.get(
    '/auth/github',
    passport.authenticate('github', {
        scope: ['profile', 'email']
    })
);

authRoute.get('/auth/github/callback', // add **/auth**
    (req,res,next)=>{
    passport.authenticate('github', { failureRedirect: '/auth/github/error' }, async (error, user , info) => {
        if (error){
            return res.send({ message: 'Tài khoản không đủ điều kiện đăng nhập' });
        }
        if (user){
        try {
            req.login(user, (error) => {
            if (error) return next(error);
            
            return res.redirect('http://localhost:5173/homeuser?userId=' + user.userId);
            });
        } catch (error) {
            return res.send({ message:error.message });
        }
        }
    })(req, res, next);

    }
);

export default authRoute;