const express = require('express')
const app = express()
app.use(express.json())

const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

let {open} = require('sqlite')
let sqlite3 = require('sqlite3')

let {join} = require('path')
let address = join(__dirname, 'twitterClone.db')

db = null
let initelizer = async function () {
  try {
    db = await open({
      filename: address,
      driver: sqlite3.Database,
    })
  } catch (e) {
    console.log(`error msg ${e}`)
    process.exit(1)
  }
  app.listen(3000, () => {
    console.log(
      '________________________running at port 3000___________________________',
    )
  })
}
initelizer()

//authontication

let authontication = (request, response, next) => {
  let jwtToken
  let token = request.headers['authorization'] // Extract token from request headers
  // Check if token exists in headers
  if (token !== undefined) {
    jwtToken = token.split(' ')[1] // Extract JWT token (assuming "Bearer token" format)
  }
  // If JWT token is not provided or undefined
  if (jwtToken === undefined) {
    response.status(401) // Unauthorized status
    response.send('Invalid JWT Token') // Send error message
  } else {
    // Verify the JWT token
    jwt.verify(jwtToken, 'I_AM_CHAMPION', async (error, payload) => {
      // **Scenario 1**: Invalid or expired token
      if (error) {
        response.status(401) // Unauthorized status
        response.send('Invalid JWT Token') // Send error message
      } else {
        // **Scenario 2**: Token is valid, proceed to the next middleware or route handler
        request.username = payload.username
        next()
      }
    })
  }
}

//API1 (register)
app.post('/register/', async (request, response) => {
  let obj = request.body
  let {username, password, name, gender} = obj
  let qu = `select * from user where username="${username}";`
  let user = await db.get(qu)

  if (user !== undefined) {
    response.status(400)
    response.send('User already exists')
  } else {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      let hashesPassword = await bcrypt.hash(password, 10)
      let qu2 = `insert into user(name,username,password,gender) values("${name}","${username}","${hashesPassword}","${gender}");`
      await db.run(qu2)
      response.send('User created successfully')
    }
  }
})

app.post('/login/', async (request, response) => {
  let {username, password} = request.body
  let qu = `select * from user where username="${username}";`
  let user = await db.get(qu)
  if (user === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    let isPasswordValid = await bcrypt.compare(password, user.password)
    if (isPasswordValid) {
      let payload = {username: username}
      let jwtToken = jwt.sign(payload, 'I_AM_CHAMPION')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//API 3
app.get('/user/tweets/feed/', authontication, async (request, response) => {
  let {username} = request
  let qu = `select u2.username,t.tweet,t.date_time  as dateTime from user as u join follower as f on u.user_id=f.follower_user_id join tweet as t on t.user_id=f.following_user_id join user u2 on u2.user_id=t.user_id where u.username="${username}" order by t.date_time desc limit 4 offset 0;`
  let arr = await db.all(qu)
  response.send(arr)
})

//API 4
app.get('/user/following/', authontication, async (request, response) => {
  let {username} = request
  let qu = `select u2.name from user as u join follower as f on u.user_id=f.follower_user_id join user as u2 on f.following_user_id=u2.user_id where u.username="${username}";`
  let arr = await db.all(qu)
  response.send(arr)
})

//API 5
app.get('/user/followers/', authontication, async (request, response) => {
  let {username} = request
  let qu = `select u2.name from user as u join follower as f on u.user_id=f.following_user_id join user as u2 on f.follower_user_id=u2.user_id where u.username="${username}";`
  let arr = await db.all(qu)
  response.send(arr)
})

//API 6
app.get('/tweets/:tweetId/', authontication, async (request, response) => {
  let {tweetId} = request.params
  let {username} = request
  let qu = `select * from user where username="${username}";`
  let user = await db.get(qu)
  let {user_id} = user
  let qu1 = `select t.tweet,count(l.like_id) as likes,count(r.reply_id) as replies,t.date_time as dateTime from follower as f join tweet as t on t.user_id=f.following_user_id join like as l on l.tweet_id=t.tweet_id join reply as r on t.tweet_id=r.tweet_id where f.follower_user_id="${user_id}" and t.tweet_id="${tweetId}" group by l.tweet_id,r.tweet_id;`
  let arr = await db.get(qu1)
  console.log(arr)
  if (arr === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    response.send(arr)
  }
})

//API 7
app.get(
  '/tweets/:tweetId/likes/',
  authontication,
  async (request, response) => {
    let {tweetId} = request.params
    let {username} = request
    let qu = `select * from user as u join follower as f on u.user_id=f.follower_user_id join tweet as t on t.user_id=f.following_user_id where username="${username}" and t.tweet_id="${tweetId}";`
    let arr = await db.get(qu)
    if (arr === undefined) {
      response.status(401)
      response.send('Invalid Request')
    } else {
      let {tweet_id} = arr
      let qu1 = `select u.user_id,u.username from like as l join user as u on u.user_id=l.user_id where l.tweet_id="${tweetId}";`

      let arr2 = await db.all(qu1)
      let likes = []
      for (let j of arr2) {
        likes.push(j.username)
      }
      response.send({likes})
    }
  },
)

//API 8

app.get(
  '/tweets/:tweetId/replies/',
  authontication,
  async (request, response) => {
    let {tweetId} = request.params
    let {username} = request
    let qu = `select * from user as u join follower as f on u.user_id=f.follower_user_id join tweet as t on t.user_id=f.following_user_id where username="${username}" and t.tweet_id="${tweetId}";`
    let arr = await db.get(qu)
    if (arr === undefined) {
      response.status(401)
      response.send('Invalid Request')
    } else {
      let {tweet_id} = arr

      let qu1 = `select u.username,r.reply from user as u join reply as r on u.user_id=r.user_id where r.tweet_id="${tweetId}";`
      let replies = await db.all(qu1)
      response.send({replies})
    }
  },
)

app.get('/user/tweets/', authontication, async (request, response) => {
  let {username} = request
  let qu = `select t.tweet,count(l.like_id) as likes,count(r.reply_id) as replies,t.date_time as dateTme from user as u join tweet as t on u.user_id=t.user_id join like as l on l.tweet_id=t.tweet_id join reply as r on r.tweet_id=t.tweet_id  where u.username="${username}" group by r.tweet_id;`
  let arr = await db.all(qu)
  response.send(arr)
})

app.post('/user/tweets/', authontication, async (request, response) => {
  let obj = request.body
  let {tweet} = obj
  let {username} = request
  let qu = `select user_id from user where username="${username}";`
  let user = await db.get(qu)
  let date = new Date()
  let {user_id} = user
  let qu2 = `insert into tweet(tweet,user_id,date_time) values("${tweet}","${user_id}","${date}")`
  await db.run(qu2)
  response.send('Created a Tweet')
})
app.delete('/tweets/:tweetId/', authontication, async (request, response) => {
  let {tweetId} = request.params
  let {username} = request
  let qu = `select * from user where username="${username}";`
  let user = await db.get(qu)
  let {user_id} = user
  let qu1 = `select * from tweet where user_id="${user_id}" and tweet_id="${tweetId}";`
  let tweet = await db.get(qu1)
  if (tweet === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    let qu2 = `delete from tweet where tweet_id="${tweetId}";`
    await db.run(qu2)
    response.send('Tweet Removed')
  }
})
module.exports = app
