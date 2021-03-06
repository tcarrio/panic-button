"use strict";

const router = require("express").Router();
const passport = require("passport");
const Users = require("../models/users");
const util = require("../util");
const login = require("connect-ensure-login");

router.get("/login", (req, res, next) => {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  return res.render("login", { messages: req.flash() });
});

router.post("/login", passport.authenticate("local", {
  successReturnToOrRedirect: "/",
  failureRedirect: "/login",
  failureFlash: "Invalid username or password",
}));

router.get("/register", (req, res, next) => {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  return res.render("register", { messages: req.flash() });
});

router.post("/register", async (req, res) => {
  try {
    const user = await Users.create({
      email: req.body.email,
      password: req.body.password,
      firstName: req.body.firstName,
      lastName: req.body.lastName
    });

    req.logIn(user, (err) => {
      if (err) { return next(err); }
      res.redirect("/");
    });
  } catch (err) {
    if (err.name === 'MongoError' && err.code === 11000) {
      req.flash("error", "That email is already registered to an account");
      return res.redirect("/register");
    }
    return res.status(400).json({ success: false, message: err });
  }
});

router.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/"); //.json({ success: true });
});

// adds user to the listing for a classroom based on a given invite code
router.get("/join/:inviteCode([0-9A-Za-z+/=]+)",
    (req, res, next) => {
      if (!req.isAuthenticated()) {
        req.flash("info", "Please log in to join the class");
        console.log("Not logged in");
      }
      next();
    },
    login.ensureLoggedIn("/login"), async (req, res) => {
  const ret = await util.joinClassroomByInviteCode(req.params.inviteCode,req.user._id);
  //return (ret.success) ? res.redirect("/") : res.status(400).json(ret);
  return res.redirect("/");
});

router.use("/api/v1", require("./api"));

module.exports = router;

