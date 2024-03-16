const express = require('express');
const app = express();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.STRIPE_SECRETE_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


// middleware
app.use(cors({
    origin: [
        // 'http://localhost:5173',
        'https://easy-dine-e417d.web.app',
        'https://easy-dine-e417d.firebaseapp.com'
    ],
    credentials: true
}));
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@brand-shop-server.v1nmeuu.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const mealCollection = client.db('easyDine').collection('meals');
        const userCollection = client.db('easyDine').collection('users');
        const upcomingMealCollection = client.db('easyDine').collection('upcomingMeals');
        const requestedMealCollection = client.db('easyDine').collection('requestedMeals');


        // auth api
        app.post('/jwt', async (req, res) => {
            const user = req.body
            console.log('I need a new jwt', user)
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '365d',
            })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                })
                .send({ success: true })
        })


        app.put('/users/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body
            const query = { email: email }
            const options = { upsert: true }
            const isExist = await userCollection.findOne(query)
            if (isExist) return res.send(isExist)
            const result = await userCollection.updateOne(
                query,
                {
                    $set: { ...user, timestamp: Date.now() },
                },
                options
            )
            res.send(result)
        })


        app.put('/user/:email', async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const options = { upsert: true };
            const updatedStatus = req.body;
            const status = {
                $set: {
                    "status": updatedStatus.badge
                }
            }
            const result = await userCollection.updateOne(query, status, options)
            res.send(result)
        })

        app.put('/users/user/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const status = {
                $set: {
                    "role": 'admin'
                }
            }
            const result = await userCollection.updateOne(query, status, options)
            res.send(result)
        })



        app.get('/meals', async (req, res) => {
            const filter = req.query;
            console.log(filter);
            const text = filter.text;
            console.log(text);
            const category = filter.category;
            const lowerPrice = parseInt(filter.sort.split(',')[0])
            const higherPrice = parseInt(filter.sort.split(',')[1])
            // console.log(parseInt(lowerPrice));
            // console.log(parseInt(higherPrice));
            const query = {
                Price: { $gt: lowerPrice, $lt: higherPrice },
                MealTitle: { $regex: text, $options: 'i' },
                MealType: { $regex: category, $options: 'i' }
            }
            const cursor = mealCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.post('/meals', async (req, res) => {
            const meal = req.body;
            const result = await mealCollection.insertOne(meal)
            res.send(result);
        })


        app.get('/meals/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await mealCollection.findOne(query);
            res.send(result);
        })

        app.delete('/meals/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await mealCollection.deleteOne(query)
            res.send(result)
        })
        // update meal
        app.put('/updateMeal/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updatedMeal = req.body;
            const update = {
                $set: {
                    MealTitle: updatedMeal.MealTitle,
                    MealType: updatedMeal.MealType,
                    Ingredients: updatedMeal.Ingredients,
                    Description: updatedMeal.Description,
                    Price: updatedMeal.Price,
                    Rating: updatedMeal.Rating,
                    PostTime: updatedMeal.PostTime,
                    AdminName: updatedMeal.AdminName,
                    AdminEmail: updatedMeal.AdminEmail,
                    Likes: updatedMeal.Likes,
                    Reviews: updatedMeal.Reviews
                }
            }
            const result = await mealCollection.updateOne(filter, update, options)
            res.send(result)
        })

        // comments
        app.put('/addComment/:id', async (req, res) => {
            const id = req.params.id;
            const comment = req.body;
            console.log(comment)
            const query = { _id: new ObjectId(id) };
            const update = {
                $push: {
                    Reviews: comment
                }
            }
            const result = await mealCollection.updateOne(query, update);
            res.send(result);
        })

        app.get('/comments/:name', async (req, res) => {
            const name = req.params.name;
            const query = { "Reviews.Name": name }
            const result = await mealCollection.find(query).toArray();
            res.send(result)
        })

        app.delete('/comments/:name/:comment', async (req, res) => {
            const name = req.params.name;
            const commentText = req.params.comment
            const query = { Reviews: { $elemMatch: { Name: name, Description: commentText } } };
            const update = {
                $pull: { Reviews: { Name: name, Description: commentText } }
            }
            const result = await mealCollection.updateOne(query, update)
            res.send(result)
        })

        app.put('/comments/:name/:comment', async (req, res) => {
            const name = req.params.name;
            const commentText = req.params.comment;
            console.log(commentText)
            const updatedComment = req.body;
            console.log(updatedComment)
            const query = { Reviews: { $elemMatch: { Name: name, Description: commentText } } };
            const update = { $set: { "Reviews.$.Description": updatedComment.editedComment } }
            const result = await mealCollection.updateOne(query, update)
            res.send(result)
        })



        //user collection
        app.get('/users', async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result)
        })

        // requested meal
        app.post('/requestedMeals', async (req, res) => {
            const orderedMeal = req.body;
            const result = await requestedMealCollection.insertOne(orderedMeal)
            res.send(result)
        })

        app.get('/requestedMeals', async (req, res) => {
            const filter = req.query;
            console.log(filter)
            const query = {
                // user_name: { $regex: filter.sort, $options: 'i' },
                // email: { $regex: filter.searchedEmail, $options: 'i' }
            }
            const result = await requestedMealCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/requestedMeals/:email', async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const result = await requestedMealCollection.find(query).toArray();
            res.send(result)
        })


        app.put('/requestedMeals/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const makeDelivered = {
                $set: {
                    "status": "Delivered"
                }
            }
            const result = await requestedMealCollection.updateOne(filter, makeDelivered, options)
            res.send(result)
        })

        app.delete('/requestedMeals/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await requestedMealCollection.deleteOne(query)
            res.send(result)
        })

        //upcoming meals
        app.post('/upcomingMeals', async (req, res) => {
            const meal = req.body;
            const result = await upcomingMealCollection.insertOne(meal)
            res.send(result);
        })

        app.get('/upcomingMeals', async (req, res) => {
            const result = await upcomingMealCollection.find().toArray()
            res.send(result)
        })

        app.get('/upcomingMeals/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await upcomingMealCollection.findOne(query);
            res.send(result);
        })
        app.put('/upcomingMeals/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const update = {
                $inc: {
                    'likes': 1
                }
            }
            const result = await upcomingMealCollection.updateOne(query, update);
            res.send(result);
        })

        app.delete('/upcomingMeals/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await upcomingMealCollection.deleteOne(query)
            res.send(result)
        })


        app.put('/increase/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const update = {
                $inc: {
                    'Likes': 1
                }
            }
            const result = await mealCollection.updateOne(query, update);
            res.send(result);
        })

        app.put('/addLike/:email', async (req, res) => {
            const email = req.params.email;
            const mealTitle = req.body;
            console.log(mealTitle);
            const query = { email: email };
            const update = {
                $push: {
                    likedMeals: mealTitle.meal_title
                }
            }
            const result = await userCollection.updateOne(query, update);
            res.send(result);
        })

        //stripe payment
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            console.log('amount', amount)
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('easy dine server is running..')
})

app.listen(port, () => {
    console.log(`easy dine is running on port: ${port}`)
})