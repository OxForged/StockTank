# Generate Episode Console Commands

Run one at a time in browser DevTools console. Wait for each to finish before starting the next.

## Available Keywords

Android, Android Development, Apple, Architecture, Beauty, Books, Business & Economy, Cars, Cricket, DIY, Fashion, Food, Football, Funny, Gaming, History, Interior design, Movies, Music, News, Personal finance, Photography, Programming, Science, Space, Sports, Startups, Tech, Television, Tennis, Travel, UI - UX, Web Development, iOS Development

## 1. Tech & Science (default voices)

```js
fetch("/api/generate",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({keywords:["Tech","Science"]})}).then(r=>r.json()).then(console.log)
```

## 2. Space & Science (Simon + Lauren)

```js
fetch("/api/generate",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({keywords:["Space","Science"],voice_male:"Simon",voice_female:"Lauren"})}).then(r=>r.json()).then(console.log)
```

## 3. Gaming & Movies (Alex + Kayla)

```js
fetch("/api/generate",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({keywords:["Gaming","Movies"],voice_male:"Alex",voice_female:"Kayla"})}).then(r=>r.json()).then(console.log)
```

## 4. Startups & Business (Shaun + Olivia)

```js
fetch("/api/generate",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({keywords:["Startups","Business & Economy"],voice_male:"Shaun",voice_female:"Olivia"})}).then(r=>r.json()).then(console.log)
```

## 5. Programming & Web Dev (Elliot + Jessica)

```js
fetch("/api/generate",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({keywords:["Programming","Web Development"],voice_male:"Elliot",voice_female:"Jessica"})}).then(r=>r.json()).then(console.log)
```

## Check Task Status

Replace `TASK_ID` with the task_id from the generate response:

```js
fetch("/api/tasks/TASK_ID",{credentials:"include"}).then(r=>r.json()).then(console.log)
```
