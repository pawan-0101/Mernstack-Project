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

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}