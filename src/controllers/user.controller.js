import { asyncHandler } from "../utils/asyncHandler.js";
import {apiError}from "../utils/apiError.js"
import {User}from "../models/user.model.js"
import { uploadOnCloud } from "../utils/Cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

const generatesAccessAndRefreshToken=async(userId)=>{
    try {
        const user=await User.findById(userId)
        const accessToken=user.generateAccessToken()
        const refreshToken=user.generateRefreshToken()
         user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}


    } catch (error) {
        throw new apiError(500,"something went wrong");
        
    }
}
//registerUser
const registerUser = asyncHandler ( async (req,res)=>{
    //  res.status(200).json({
    //     message:"OK"
    // })

    //get user details from frontend
    //validation-not empty
    //check if user not already exist;name, email
    //check for images,avatar
    //upload them to cloudinary-lso avatar
    //create user object and entry in db
    //remove password and refresh token and check for user creation
    //return res
    const {fullName,email,username,password}=req.body
    // console.log("email: ",email);
    if(
        [fullName,email,username,password].some((i)=> i ?.trim()==="")
    ){
         throw new apiError(400,"All fields are required")
    }

    const existeduser=await User.findOne({
        $or:[{username},{email}]
    })
    if(existeduser)
    {
        throw new apiError(409,"User with email or username already exists")
    }
    //console.log(req.files);
    const avatarLocalpath=req.files?.avatar[0]?.path;
    const coverImageLocalpath=req.files?.coverImage[0]?.path;
    if(!avatarLocalpath){
        throw new apiError(400,"Avatar file is required");
    }
    //upload on cloudinay
    const avatar=await uploadOnCloud(avatarLocalpath)
     const coverImage=await uploadOnCloud(coverImageLocalpath)
    if(!avatar){
        throw new apiError(400,"Avatar file is required");
    }

    const user=await User.create({
        fullName,
        avatar:avatar.url,
        coverImage:coverImage?.url||"",
        email,
        password,
        username: username.toLowerCase()
    })
    const createdUser=await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if (!createdUser) {
        throw new apiError(500,"Something went wrong while register");    
    }
    return res.status(201).json(
        new apiResponse(200,createdUser,"User register successful")
    )

})

// loginUser

const loginUser = asyncHandler(async (req, res) =>{
    // req body -> data
    // username or email
    //find the user
    //password check
    //access and referesh token
    //send cookie

    const {email, username, password} = req.body
    console.log(email);

    if (!username && !email) {
        throw new apiError(400, "username or email is required")
    }
    const user = await User.findOne({
        $or:[{username},{email}]
    })

    if(!user){
        throw new apiError(404,"User does not exist")
    }
    const isPasswordValid=await user.isPasswaordCorrect(password)
    if(!isPasswordValid){
        throw new apiError(404,"Invalid user credentials")
    }
    const {accessToken,refreshToken}=await generatesAccessAndRefreshToken(user._id);
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options={
          httpOnly:true,
          secure:true,
    }
    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new apiResponse(
            200,
            {
                user:loggedInUser,accessToken,
                refreshToken
            },
            "User logged In Successfully"
        )
    )


})

//logout user
const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )
//clearcookies
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new apiResponse(200, {}, "User logged Out"))
})

//refresh token
const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new apiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET

        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new apiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new apiError(401, "Refresh token is expired or used")
            
        }
        //cookies
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generatesAccessAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new apiResponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new apiError(401, error?.message || "Invalid refresh token")
    }

})
//current password change
const changeCurrentPassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body

    

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new apiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new apiResponse(200, {}, "Password changed successfully"))
});
//get current user
const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(new apiResponse(
        200,
        req.user,
        "User fetched successfully"
    ))
})
//update account details

const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email} = req.body

    if (!fullName || !email) {
        throw new apiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName:fullName,
                email: email
            }
        },
        {new: true}
        
    ).select("-password")

    return res
    .status(200)
    .json(new apiResponse(200, user, "Account details updated successfully"))
});

//update avatar

const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path//from multer

    if (!avatarLocalPath) {
        throw new apiError(400, "Avatar file is missing")
    }

    //TODO: delete old image - assignment

    const avatar = await uploadOnCloud(avatarLocalPath)

    if (!avatar.url) {
        throw new apiError(400, "Error while uploading on avatar")
        
    }
    //login of update
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {   //multer
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")//remove password from response
    //response
    return res
    .status(200)
    .json(
        new apiResponse(200, user, "Avatar image updated successfully")
    )
})

//update cover image

const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new apiError(400, "Cover image file is missing")
    }

    //TODO: delete old image - assignment


    const coverImage = await uploadOnCloud(coverImageLocalPath)

    if (!coverImage.url) {
        throw new apiError(400, "Error while uploading on avatar")
        
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")
     //response
    return res
    .status(200)
    .json(
        new apiResponse(200, user, "Cover image updated successfully")
    )
})

// get user channel profile

const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params  // from URL params  

    if (!username?.trim()) {
        throw new apiError(400, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1

            }
        }
    ])

    if (!channel?.length) {
        throw new apiError(404, "channel does not exists")
    }

    return res
    .status(200)
    .json(
        new apiResponse(200, channel[0], "User channel fetched successfully")
    )
});

//get watch history

const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
});







export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory,
}