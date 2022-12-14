const express = require('express')
const { setTokenCookie, requireAuth } = require('../../utils/auth');
const { User, Spot, Booking, Review, SpotImage, ReviewImage, sequelize } = require('../../db/models');
const { check } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');
const { Model } = require('sequelize');
const user = require('../../db/models/user');
const spot = require('../../db/models/spot');
const { Op } = require('sequelize');
const router = express.Router();

const validateSpot = [
    check('address')
        .exists({ checkFalsy: true })
        .notEmpty()
        .withMessage('Street address is required.'),
    check('address')
        .isLength({ min: 1, max: 50 })
        .withMessage('Stress address must be less than 50 characters'),
    check('city')
        .exists({ checkFalsy: true })
        .notEmpty()
        .withMessage('City is required.'),
    check('city')
        .isLength({ min: 1, max: 50 })
        .withMessage('City must be less than 50 characters'),
    check('city')
        .isAlpha('en-US', { ignore: ' ' })
        .withMessage('City cannot be a number'),
    check('state')
        .exists({ checkFalsy: true })
        .notEmpty()
        .withMessage('State is required.'),
    check('state')
        .isLength({ min: 1, max: 50 })
        .withMessage('State must be less than 50 characters'),
    check('state')
        .isAlpha('en-US', { ignore: ' ' })
        .withMessage('State cannot be a number.'),
    check('country')
        .exists({ checkFalsy: true })
        .notEmpty()
        .withMessage('Country is required.'),
    check('country')
        .isLength({ min: 1, max: 50 })
        .withMessage('Country must be less than 50 characters'),
    check('country')
        .isAlpha('en-US', { ignore: ' ' })
        .withMessage('Country cannot be a number.'),
    check('name')
        .exists({ checkFalsy: true })
        .isLength({ min: 1, max: 50 })
        .withMessage('Name must exist and be less than 50 characters.'),
    check('description')
        .exists({ checkFalsy: true })
        .withMessage('Description is required.'),
    check('price')
        .exists({ checkFalsy: true })
        .isInt({ min: 1 })
        .withMessage('Price is required and must be greater than 0.'),
    handleValidationErrors
];

const validateReview = [
    check('review')
        .exists({ checkFalsy: true })
        .isLength({ min: 1, max: 255 })
        .withMessage('Review text is required. Character Limit: 255'),
    check('stars')
        .exists({ checkFalsy: true })
        .isInt({ gt: 0, lt: 6 })
        .withMessage('Stars must be an integer from 1 to 5.'),
    handleValidationErrors
];

//delete spot

router.delete('/:spotId', requireAuth, async (req, res, next) => {
    const currentSpot = await Spot.findByPk(req.params.spotId)
    if (!currentSpot) {
        res.status(404)
        res.json({
            "message": "Spot couldn't be found",
            "statusCode": 404
        })
    } else {
        await currentSpot.destroy()
        res.json({
            "message": "Successfully deleted",
            "statusCode": 200
        })
    }
})


//create review for Spot
router.post('/:id/reviews', validateReview, requireAuth, async (req, res, next) => {
    const spot = await Spot.findByPk(req.params.id)
    const userId = req.user.id
    const { review, stars } = req.body
    if (!spot) {
        res.status(404)
        res.json({
            "message": "Spot couldn't be found",
            "statusCode": 404
        })
    } else {
        const oldReview = await Review.findAll({
            where: {
                [Op.and]: [
                    { spotId: spot.id },
                    { userId: userId }
                ]
            }
        });
        if (oldReview.length) {
            res.status(403)
            res.json({
                "message": "User already has a review for this spot",
                "statusCode": 403
            })
        } else {
            let newReview = await Review.create({
                userId,
                spotId: spot.id,
                review,
                stars
            })
            res.status(201)
            res.json(newReview)
        }

    }
})

//Get all Review by Spot's ID
router.get('/:spotId/reviews', async (req, res, next) => {
    const { spotId } = req.params
    const currentSpot = await Spot.findByPk(spotId)
    const allReviews = await Review.findAll({
        where: {
            spotId: spotId
        },
        include: [
            {
                model: User,
                attributes: ['id', "firstName", "lastName", "profile_url"]
            },
            {
                model: ReviewImage,
                attributes: ["id", "url"]
            }
        ]
    })
    if (!currentSpot) {
        res.status(404)
        res.json({
            "message": "Spot couldn't be found",
            "statusCode": 404
        })
    }
    res.json({ Reviews: allReviews })
})


//get all spots owned by current user
router.get('/current', requireAuth, async (req, res, next) => {
    const userId = req.user.id
    let userSpots = {}
    userSpots = await Spot.findAll({
        where: {
            ownerId: userId
        },
        raw: true
    })
    for (const spot of userSpots) {
        const avg = await Review.findAll({
            where: { spotId: spot.id },
            attributes: [[sequelize.fn('AVG', sequelize.col('stars')), 'average']],
            raw: true
        })

        let numberWithDecimal = parseFloat(`${avg[0].average}`)
        let newNumber = (parseFloat(numberWithDecimal).toFixed(1))
        if (newNumber == "NaN") {
            spot.avgRating = "There is no Rating attached to this user"
        } else {
            spot.avgRating = newNumber
        }

    }
    for (const spot of userSpots) {
        const image = await SpotImage.findAll({
            where: { spotId: spot.id, preview: true },
            attributes: ['url'],
            raw: true
        })
        spot.previewImage = image[0].url
    }
    res.json({ Spots: userSpots })
})

//get spot by spotId
router.get('/:id', async (req, res) => {
    const spot = await Spot.findByPk(req.params.id, {
        include: [{
            model: SpotImage,
            attributes: ["id", "url", "preview"]
        },
        { model: User, attributes: ["id", "firstName", "lastName", "profile_url"], as: "Owner" }]
    })
    if (!spot) {
        res.status(404)
        res.json({
            "message": "Spot couldn't be found",
            "statusCode": 404
        })
    } else {
        const reviewData = await Review.findAll({
            where: {
                spotId: spot.id
            },
            attributes: [[sequelize.fn('AVG', sequelize.col('stars')), 'avgRating'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'numReviews']],
            raw: true
        });
        spot.dataValues.numReviews = reviewData[0].numReviews;
        spot.dataValues.avgStarRating = reviewData[0].avgRating;
        res.json(spot)
    }
})
//get all spots
router.get('/', async (req, res, next) => {

    let { size, page } = req.query
    let paginatination = {}


    page = parseInt(page)
    size = parseInt(size)

    //page query
    if (!page || isNaN(page)) {
        page = 1
    } else if (page < 1) {
        errors.page = "Page must be greater than or equal to 1"
    }

    if (!size || isNaN(size)) {
        size = 20
    } else if (size < 1) {
        errors.size = "Size must be greater than or equal to 1"
    }
    // if(!maxLat || isNaN(maxLat) || maxLat <= minLat){
    //     errors.maxLat = "Maximum latitude is invalid"
    // }
    // if(!minLat || isNaN(minLat) || minLat >= maxLat){
    //     errors.minLat = "Minimum latitude is invalid"
    // }
    // if(!minLng || isNaN(minLng) || minLng >= maxLng){
    //     errors.minLng = "Minimum longitude is invalid"
    // }
    // if(!maxLng || isNaN(maxLng) || maxLng <= minLng) {
    //     errors.maxLng = "Maximum longitude is invalid"
    // }
    // if(!minPrice || isNaN(minPrice) || minPrice < 0 || minPrice >= maxPrice){
    //     errors.minPrice = "Minimum price must be greater than or equal to 0"
    // }
    // if(!maxPrice || isNaN(maxPrice) || maxPrice < 0 || maxPrice <= minPrice){
    //     errors.maxPrice = "Maximum price must be greater than or equal to 0"
    // }
    // if(Object.keys(errors).length) {
    //     res.status(400)
    //     let errors = {
    //         "message": "Validation Error",
    //         "statusCode": 400,
    //         errors
    //     }
    //     return res.json(errors)
    // }
    if (page >= 1 && size >= 1) {
        paginatination.limit = size
        paginatination.offset = size * (page - 1)
    }


    let allSpots = []
    const spots = await Spot.findAll({
        ...paginatination
    })

    for (const spot of spots) {
        const avg = await Review.findAll({
            where: { spotId: spot.id },
            attributes: [[sequelize.fn('AVG', sequelize.col('stars')), 'average']],
            raw: true
        })
        const image = await SpotImage.findAll({
            where: {
                spotId: spot.id,
                [Op.or]: [{ preview: true }, { preview: false }]
            },
            attributes: ['url'],
            raw: true
        })
        let allSpot = spot.toJSON()

        allSpot.avgRating = (Number(avg[0].average))
        allSpot.previewImage = image.length > 0 ? image[0].url : ""
        allSpots.push(allSpot)
    }
    res.json({ Spots: allSpots, page: page, size: size })
})


//Create Spot
router.post('/', validateSpot, requireAuth, async (req, res, next) => {
    const { address, city, state, country, lat, lng, name, description, price } = req.body
    const newSpot = await Spot.create({
        ownerId: req.user.id,
        address,
        city,
        state,
        country,
        lat,
        lng,
        name,
        description,
        price
    })
    res.status(201)
    return res.json(newSpot)

})

//add an img to spot based on spot's ID
router.post('/:id/images', requireAuth, async (req, res, next) => {
    const spot = await Spot.findByPk(req.params.id)
    const userId = req.user.id
    const { url, preview } = req.body

    if (!spot) {
        res.status(404)
        res.json({
            "message": "Spot couldn't be found",
            "statusCode": 404
        })
    }
    const newImg = await SpotImage.create({
        spotId: spot.id,
        url,
        preview
    })

    const ele = await SpotImage.findByPk(newImg.id)
    res.json(ele)
}),

    //edit spot
    router.put('/:id', validateSpot, requireAuth, async (req, res, next) => {
        const updatedSpot = await Spot.findByPk(req.params.id)
        const { address, city, state, country, lat, lng, name, description, price } = req.body
        if (!updatedSpot) {
            res.status(404)
            res.json({
                "message": "Spot couldn't be found",
                "statusCode": 404
            })
        } else {
            updatedSpot.set({
                address, city, state, country, lat, lng, name, description, price
            })
            await updatedSpot.save()
            res.json(updatedSpot)
        }
    })

// create booking from spot based on SpotId
router.post('/:spotId/bookings', requireAuth, async (req, res, next) => {
    const { startDate, endDate } = req.body // startdate/enddate is a string
    const currentSpot = await Spot.findByPk(req.params.spotId)
    if (!currentSpot) {
        res.status(404)
        res.json({
            "message": "Spot couldn't be found",
            "statusCode": 404
        })
    }
    const currentBooking = await Booking.findAll({ //return array
        where: {
            spotId: currentSpot.id
        }
    })
    const currentEndDate = new Date(endDate).getTime() //converts enddate/startdate to date object and getTIme converts to seconds
    const currentStartDate = new Date(startDate).getTime()
    if ((currentEndDate <= currentStartDate)) {
        res.status(400)
        res.json({
            "message": "Validation error",
            "statusCode": 400,
            "errors": {
                "endDate": "endDate cannot be on or before startDate"
            }
        })
    }
    // else if(currentSpot.ownerId === req.user.id) {
    //     res.status(403)
    //     res.json({
    //         "message": "Sorry, this spot is already booked for the specified dates",
    //         "statusCode": 403,
    //         "errors": {
    //           "startDate": "Start date conflicts with an existing booking",
    //           "endDate": "End date conflicts with an existing booking"
    //         }
    //       })
    // }
    for (const specificBooking of currentBooking) {  //specficbooking.startDate/endDate is a string
        const oldStartDate = new Date(specificBooking.startDate).getTime() // converts to date object in seconds.
        const oldEndDate = new Date(specificBooking.endDate).getTime()
        if ((oldStartDate >= currentStartDate && oldEndDate <= currentEndDate) || (oldStartDate <= currentStartDate && oldEndDate >= currentEndDate)) {
            // if booking exists return error
            res.status(403)
            res.json({
                "message": "Sorry, this spot is already booked for the specified dates",
                "statusCode": 403,
                "errors": {
                    "startDate": "Start date conflicts with an existing booking",
                    "endDate": "End date conflicts with an existing booking"
                }
            })
        }
    }
    const newBooking = await Booking.create({
        spotId: currentSpot.id,
        userId: req.user.id,
        startDate,
        endDate
    })
    return res.json(newBooking)
})


//get all booking for spot based on spot id
router.get('/:spotId/bookings', requireAuth, async (req, res, next) => {

    const currentSpot = await Spot.findByPk(req.params.spotId)
    if (!currentSpot) {
        res.status(404)
        res.json({
            "message": "Spot couldn't be found",
            "statusCode": 404
        })
    } else if (currentSpot.ownerId === req.user.id) { //if owner owns spot, this comes first due to else if condition
        const ownerBooking = await Booking.findAll({
            where: {
                spotId: currentSpot.id
            },
            include: {
                model: User,
                attributes: ["id", "firstName", "lastName"]
            }
        })
        res.json({ Bookings: ownerBooking })
    } else { //no owner of spot
        const currentBooking = await Booking.findAll({
            where: {
                spotId: currentSpot.id
            },
            attributes: ["spotId", "startDate", "endDate"]
        })
        res.json({ Bookings: currentBooking })
    }
})






// delete
router.delete('/:id', requireAuth, async (req, res, next) => {
    const deletedSpot = await Spot.findByPk(req.params.id)
    if (!deletedSpot) {
        res.status(404)
        res.json({
            "message": "Spot couldn't be found",
            "statusCode": 404
        })
    }
    await deletedSpot.destroy()
    res.json({
        "message": "Successfully deleted",
        "statusCode": 200
    })
})














module.exports = router;
