"use strict";

const request = require("request-promise");
const tough = require("tough-cookie");
const users = require("./data/users");
const classrooms = require("./data/classrooms");

const io = require("socket.io-client");
const baseUrl = 'http://localhost:3000';
const options = {  
  transports: ['websocket'],
  'force new connection': true
};

let authToken;
function getTimeout(done,sock=false) {
    const timeout = setTimeout(() => {
        if(sock)
            sock.disconnect();
        done(new Error("Timed out"));
    },1500);
    return function (err=false) {
        clearTimeout(timeout);
        if(!err)
            done();
        else
            done(err);
    }
}

// This series of tests uses user[2] for registration. login, and manipulation
describe("Socket.IO", () => {
    let client1, client2, client3;

    it("should connect to the server successfully", (done) => {
        const endTest = getTimeout(done,client1);
        client1 = io(baseUrl, options);
        client1.on("connect",()=>{
            expect(client1.connected).to.equal(true);
            client1.disconnect();
            endTest();
        });
    });

    it("should login to server using token", (done) => {
        const endTest = getTimeout(done);
        const thisUser = users[3];
        const j = request.jar();
        const loginOpts = {
            method: "POST",
            uri: baseUrl + "/login",
            json: true,
            body: {
                email: thisUser.email,
                password: thisUser.password,
            },
            jar: j,
        };
        const authOpts = {
            method: "POST",
            uri: baseUrl + "/api/v1/authenticate",
            json: true,
            jar: j,
            resolveWithFullResponse: true,
        };

        request(loginOpts)
        .then( (user) => {
            expect(user.firstName).to.equal(thisUser.firstName);
            expect(user.lastName).to.equal(thisUser.lastName);
            return request(authOpts);
        }).then( (auth) => {
            expect(auth.statusCode).to.equal(200);
            authToken = auth.body.token;
            client2 = io(baseUrl, options);
            client2.on("connect",()=>{
                client2.emit("login", authToken);
                client2.on("login_success",(status)=>{
                    expect(status).to.equal(true);
                    endTest();
                });
            });
        })
        .catch( (err) => {
            endTest(err);
        }); 
    });

    it("should emit messages to server", (done) => {
        const endTest = getTimeout(done,client3);
        client3 = io(baseUrl, options);
        client3.emit("login",authToken);
        client3.on("login_success", (status)=>{
            expect(status).to.equal(true);
            client3.emit("panic", { classroom: "asdf", state: true });
            endTest();
        });
    });

    it("should receive panic updates from the server", (done) => {
        const endTest = getTimeout(done,client2);
        const thisUser = users[4];
        const j = request.jar();
        const loginOpts = {
            method: "POST",
            uri: baseUrl + "/login",
            json: true,
            body: {
                email: thisUser.email,
                password: thisUser.password,
            },
            jar: j,
            resolveWithFullResponse: true,
        };
        const classOpts = {
            method: "GET",
            uri: baseUrl + "/api/v1/classrooms",
            json: true,
            jar: j,
        };
        request(loginOpts)
        .then((loginReq)=>{
            expect(loginReq.statusCode).to.equal(200);
            expect(loginReq.body.firstName).to.equal(thisUser.firstName);
            expect(loginReq.body.lastName).to.equal(thisUser.lastName);
            return request(classOpts);
        }).then((classes)=>{
            expect(classes.length).to.equal(1);
            client2.emit("panic", { classroom: classes[0]._id, state: true });
            client2.on("panic",(body) => {
                expect(body.panicNumber).to.equal(1);
                endTest();
            });
        }).catch( (err) => {
            endTest(err);
        });
    });
});